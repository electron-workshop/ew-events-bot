import { Markup } from "telegraf";
import { config } from "../../config.js";
import { createCalendarEvent } from "../../services/calendar.js";
import {
  getPending,
  deletePending,
  setEditMessageId,
  markAwaitingEdit,
} from "../../store/pendingEvents.js";
import { formatFieldsSummary, EDIT_INSTRUCTIONS } from "../formatEvent.js";
import { log } from "../../logger.js";
import { answerCb } from "../answerCb.js";

async function notifyAdminIfNeeded(ctx, entry, event) {
  if (!config.adminChatId) return;
  if (String(entry.requesterId) === String(config.adminChatId)) return;

  await ctx.telegram.sendMessage(
    config.adminChatId,
    `New event added by ${entry.requesterName} from ${entry.sourceUrl}:\n\n${formatFieldsSummary(
      entry.fields
    )}\n\n${event.htmlLink}`,
    { parse_mode: "Markdown" }
  );
}

export function registerCallbackHandlers(bot) {
  bot.action(/^confirm:(.+)$/, async (ctx) => {
    const id = ctx.match[1];
    const entry = getPending(id);
    log("confirm", `pending ${id} confirmed by ${ctx.from.id}`);
    if (!entry) {
      log("confirm", `pending ${id} not found (expired?)`);
      await answerCb(ctx, "This request has expired.");
      return;
    }

    await answerCb(ctx, "Adding to the calendar...");

    let event;
    try {
      event = await createCalendarEvent(entry.fields, entry.sourceUrl);
    } catch (error) {
      log("confirm", `calendar insert failed for ${id}: ${error.message}`);
      await ctx.reply(`Failed to create the calendar event: ${error.message}`);
      return;
    }

    deletePending(id);
    // Leave the preview message as-is (with the extracted details) and just
    // drop its buttons, rather than overwriting it — the details stay visible.
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    await ctx.reply(`Added to the calendar: ${event.htmlLink}`);

    await notifyAdminIfNeeded(ctx, entry, event);
  });

  bot.action(/^cancel:(.+)$/, async (ctx) => {
    const id = ctx.match[1];
    deletePending(id);
    await answerCb(ctx, "Cancelled.");
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    await ctx.reply("Cancelled — nothing was added to the calendar.");
  });

  bot.action(/^edit:(.+)$/, async (ctx) => {
    const id = ctx.match[1];
    const entry = getPending(id);
    if (!entry) {
      log("edit", `pending ${id} not found (expired?)`);
      await answerCb(ctx, "This request has expired.");
      return;
    }

    // Mark first: if sending the instructions fails, their next message should
    // still be treated as the edit rather than vanishing.
    markAwaitingEdit(id);
    log("edit", `pending ${id} awaiting edited fields from ${ctx.from.id}`);

    await answerCb(ctx);
    const sentMessage = await ctx.reply(EDIT_INSTRUCTIONS);
    setEditMessageId(id, sentMessage.message_id);
  });
}
