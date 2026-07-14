import { isAwaitingLink, clearAwaitingLink } from "../../store/awaitingLink.js";
import { processEventUrl } from "../commands/addEvent.js";
import { log } from "../../logger.js";

const URL_PATTERN = /https?:\/\/\S+/i;

export function registerAwaitingLinkHandler(bot) {
  bot.on("text", async (ctx, next) => {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;

    if (!isAwaitingLink(chatId, userId)) return next();

    const match = ctx.message.text.match(URL_PATTERN);
    if (!match) {
      await ctx.reply(
        "That doesn't look like a link — send the event URL, or wait a few minutes for this to expire."
      );
      return;
    }

    clearAwaitingLink(chatId, userId);
    log("add_event", `got awaited link from ${userId}: ${match[0]}`);
    await processEventUrl(ctx, match[0]);
  });
}
