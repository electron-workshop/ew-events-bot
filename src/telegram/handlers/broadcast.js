import { isAdmin } from "../isAdmin.js";
import { isAwaitingBroadcast, clearAwaitingBroadcast } from "../../store/broadcastState.js";
import { setPendingBroadcast, getPendingBroadcast, clearPendingBroadcast } from "../../store/pendingBroadcast.js";
import { sendBroadcast, broadcastPreview } from "../sendBroadcast.js";
import { log } from "../../logger.js";
import { answerCb } from "../answerCb.js";

// Captures the admin's next message after /blast as the broadcast draft.
export function registerBroadcastComposeHandler(bot) {
  bot.on("text", async (ctx, next) => {
    if (!isAwaitingBroadcast() || !isAdmin(ctx)) return next();

    clearAwaitingBroadcast();
    const text = ctx.message.text;
    const pending = setPendingBroadcast(text);
    log("blast", `broadcast drafted by ${ctx.from.id}`);

    const preview = broadcastPreview(text, pending.id);
    await ctx.reply(preview.text, preview.keyboard);
  });
}

export function registerBroadcastActionHandlers(bot) {
  bot.action(/^blast_confirm:(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) {
      await answerCb(ctx);
      return;
    }

    const pending = getPendingBroadcast(ctx.match[1]);
    if (!pending) {
      await answerCb(ctx, "This draft has expired.");
      return;
    }

    await answerCb(ctx, "Sending...");
    clearPendingBroadcast();

    const { sent, failed } = await sendBroadcast(ctx.telegram, pending.text);
    await ctx.editMessageText(
      `📣 Broadcast sent to ${sent} chat(s)${failed ? ` (${failed} failed)` : ""}.`
    );
  });

  // Sends the real thing to the admin alone, so a broadcast can be checked
  // end to end without anyone else receiving it. The draft stays pending, so
  // the same preview can then be sent for real.
  bot.action(/^blast_test:(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) {
      await answerCb(ctx);
      return;
    }

    const pending = getPendingBroadcast(ctx.match[1]);
    if (!pending) {
      await answerCb(ctx, "This draft has expired.");
      return;
    }

    await answerCb(ctx, "Sending to you only...");
    const { sent, failed } = await sendBroadcast(ctx.telegram, pending.text, {
      onlyChatId: ctx.chat.id,
    });
    log("blast", `test send to admin: ${sent} sent, ${failed} failed`);

    await ctx.reply(
      failed
        ? "Couldn't send the test to you — check the logs."
        : "That's the test copy above, exactly as everyone else would see it. " +
            "The buttons are shown even though you've been asked before, so you can check them. " +
            "Tapping them does change your own setting.\n\n" +
            "The draft is still waiting — scroll up and hit Send to everyone when you're happy."
    );
  });

  bot.action(/^blast_cancel:(.+)$/, async (ctx) => {
    clearPendingBroadcast();
    await answerCb(ctx, "Cancelled.");
    await ctx.editMessageText("Broadcast cancelled — nothing was sent.");
  });
}
