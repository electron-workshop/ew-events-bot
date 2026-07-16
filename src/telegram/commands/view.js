import { config } from "../../config.js";

export async function handleView(ctx) {
  // Telegram's HTML parse mode requires "&" inside attribute values to be
  // escaped too, even though it's not user-supplied — otherwise it can
  // mis-parse the entity.
  const escapedUrl = config.calendarPublicUrl.replace(/&/g, "&amp;");
  await ctx.reply(`<a href="${escapedUrl}">📅 View Calendar</a>`, { parse_mode: "HTML" });
}
