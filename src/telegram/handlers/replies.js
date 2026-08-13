import { Markup } from "telegraf";
import {
  findPendingByEditMessage,
  findAwaitingEdit,
  updatePendingFields,
  clearAwaitingEdit,
} from "../../store/pendingEvents.js";
import { formatFieldsSummary, EDIT_INSTRUCTIONS } from "../formatEvent.js";
import { log } from "../../logger.js";
import { parseFieldLines, splitInvalidFields, FIELD_FORMATS } from "../fields.js";
import { normalizeSchedule } from "../../services/extractEvent.js";

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

    const parsed = parseFieldLines(ctx.message.text);
    if (Object.keys(parsed).length === 0) {
      log("edit", `no recognisable fields from ${ctx.from.id} for pending ${entry.id}`);
      await ctx.reply(
        `I couldn't find any fields in that.\n\n${EDIT_INSTRUCTIONS}`
      );
      return;
    }

    const { valid: updates, rejected } = splitInvalidFields(parsed);
    if (rejected.length > 0) {
      log("edit", `pending ${entry.id} rejected fields from ${ctx.from.id}: ${rejected.join(", ")}`);
    }

    // Nothing usable left, so keep them in edit mode rather than showing a
    // preview that ignored everything they typed.
    if (Object.keys(updates).length === 0) {
      await ctx.reply(
        `I couldn't use that:\n\n` +
          rejected.map((key) => `• ${key} needs ${FIELD_FORMATS[key]}`).join("\n") +
          `\n\nSend it again with those fixed.`
      );
      return;
    }

    // Normalize against the merged fields, not the edit alone — "date: 22nd to
    // 23rd" needs splitting, and a lone "end_date:" has to be checked against
    // whichever start date the draft already had.
    const merged = normalizeSchedule({ ...entry.fields, ...updates });
    updatePendingFields(entry.id, merged);
    log("edit", `pending ${entry.id} updated by ${ctx.from.id}: ${Object.keys(updates).join(", ")}`);

    const notes = rejected.length
      ? `\n\nI couldn't use ${rejected.map((key) => `${key} (needs ${FIELD_FORMATS[key]})`).join(", ")}, so that's unchanged.`
      : "";

    await ctx.reply(
      `Updated:\n\n${formatFieldsSummary(merged)}${notes}\n\nAdd this to the calendar?`,
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
