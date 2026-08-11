import { Markup } from "telegraf";
import {
  findPendingByEditMessage,
  findAwaitingEdit,
  updatePendingFields,
  clearAwaitingEdit,
} from "../../store/pendingEvents.js";
import { formatFieldsSummary, EDIT_INSTRUCTIONS } from "../formatEvent.js";
import { log } from "../../logger.js";
import { parseFieldLines } from "../fields.js";

export function registerReplyHandler(bot) {
  bot.on("text", async (ctx, next) => {
    // Prefer the message they actually replied to — that's unambiguous even
    // with several drafts open. Otherwise fall back to whichever draft they
    // last tapped Edit on, so a plain message works too.
    const replyTo = ctx.message.reply_to_message;
    const entry =
      (replyTo && findPendingByEditMessage(ctx.chat.id, replyTo.message_id)) ||
      findAwaitingEdit(ctx.chat.id, ctx.from.id);
    if (!entry) return next();

    const updates = parseFieldLines(ctx.message.text);
    if (Object.keys(updates).length === 0) {
      log("edit", `no recognisable fields from ${ctx.from.id} for pending ${entry.id}`);
      await ctx.reply(
        `I couldn't find any fields in that.\n\n${EDIT_INSTRUCTIONS}`
      );
      return;
    }

    updatePendingFields(entry.id, updates);
    log("edit", `pending ${entry.id} updated by ${ctx.from.id}: ${Object.keys(updates).join(", ")}`);

    await ctx.reply(
      `Updated:\n\n${formatFieldsSummary({ ...entry.fields, ...updates })}\n\nAdd this to the calendar?`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          Markup.button.callback("Confirm", `confirm:${entry.id}`),
          Markup.button.callback("Edit", `edit:${entry.id}`),
          Markup.button.callback("Cancel", `cancel:${entry.id}`),
        ]),
      }
    );

    // Only now — if the summary failed to send, they're still in edit mode and
    // can just send the details again instead of hunting for the Edit button.
    clearAwaitingEdit(entry.id);
  });
}
