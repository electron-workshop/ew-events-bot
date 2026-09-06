import { Markup } from "telegraf";
import { config } from "../config.js";

/**
 * An "open the app" button, for the places where the web form can do something
 * the chat can't — filling in an event the bot couldn't read, or browsing the
 * calendar properly.
 *
 * Returns an empty object when there's no app configured, or when the message
 * is going to a group: Telegram only allows web_app buttons in private chats.
 * Spread it into a reply's options either way.
 */
export function miniAppKeyboard(ctx, label = "Open the events app") {
  if (!config.miniAppUrl) return {};
  if (ctx.chat?.type !== "private") return {};
  return Markup.inlineKeyboard([Markup.button.webApp(label, config.miniAppUrl)]);
}

/** True when there's an app to point people at. */
export function hasMiniApp() {
  return Boolean(config.miniAppUrl);
}
