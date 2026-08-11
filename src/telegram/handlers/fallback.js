import { hasPendingInChat } from "../../store/pendingEvents.js";
import { looksLikeFieldEdit } from "../fields.js";
import { log } from "../../logger.js";

// Last handler in the chain. Before this existed, a DM that matched nothing
// got no reply and no log line, which is how the edit bug went unnoticed.
export function registerFallbackHandler(bot) {
  bot.on("text", async (ctx) => {
    // Only in DMs — a catch-all in a group would reply to every message.
    if (ctx.chat.type !== "private") return;

    const text = ctx.message.text;
    log("fallback", `unhandled text from ${ctx.from.id}: ${JSON.stringify(text.slice(0, 80))}`);

    if (looksLikeFieldEdit(text)) {
      await ctx.reply(
        hasPendingInChat(ctx.chat.id)
          ? "That looks like event details, but I'm not editing anything right now. Tap Edit on the event above, then send them again."
          : "That looks like event details, but I don't have an event waiting — it may have expired. Send the link again with /add_event."
      );
      return;
    }

    await ctx.reply(
      "Not sure what to do with that.\n\n" +
        "• /add_event <link> — add an event to the calendar\n" +
        "• /today, /tomorrow, /week, /month — what's coming up\n" +
        "• /start — everything I can do"
    );
  });
}
