import { Markup } from "telegraf";
import {
  findPendingByEditMessage,
  updatePendingFields,
} from "../../store/pendingEvents.js";
import { formatFieldsSummary } from "../formatEvent.js";

const FIELD_KEYS = ["title", "date", "time", "location", "description", "register_link"];

function parseFieldLines(text) {
  const updates = {};
  for (const line of text.split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim().toLowerCase().replace(/\s+/g, "_");
    const value = line.slice(separatorIndex + 1).trim();

    if (FIELD_KEYS.includes(key) && value) {
      updates[key] = value;
    }
  }
  return updates;
}

export function registerReplyHandler(bot) {
  bot.on("text", async (ctx, next) => {
    const replyTo = ctx.message.reply_to_message;
    if (!replyTo) return next();

    const entry = findPendingByEditMessage(ctx.chat.id, replyTo.message_id);
    if (!entry) return next();

    const updates = parseFieldLines(ctx.message.text);
    if (Object.keys(updates).length === 0) {
      await ctx.reply("Didn't recognise any fields in that — use the `field: value` format shown above.");
      return;
    }

    updatePendingFields(entry.id, updates);

    await ctx.reply(
      `Updated:\n\n${formatFieldsSummary({ ...entry.fields, ...updates })}\n\nAdd this to the calendar?`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          Markup.button.callback("Confirm", `confirm:${entry.id}`),
          Markup.button.callback("Edit", `edit:${entry.id}`),
          Markup.button.callback("Cancel", `cancel:${entry.id}`),
        ]),
      }
    );
  });
}
