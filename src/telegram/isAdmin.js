import { config } from "../config.js";

export function isAdmin(ctx) {
  return Boolean(config.adminChatId) && String(ctx.from.id) === String(config.adminChatId);
}
