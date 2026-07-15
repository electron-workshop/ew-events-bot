import { config } from "../../config.js";

export async function handleView(ctx) {
  await ctx.reply(`📅 Electron Workshop calendar:\n${config.calendarPublicUrl}`);
}
