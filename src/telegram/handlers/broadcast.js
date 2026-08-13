import { isAdmin } from "../isAdmin.js";
import { isAwaitingBroadcast, clearAwaitingBroadcast } from "../../store/broadcastState.js";
import { setPendingBroadcast, getPendingBroadcast, clearPendingBroadcast } from "../../store/pendingBroadcast.js";
import { sendBroadcast, broadcastPreview, testerCounts } from "../sendBroadcast.js";
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

  // A genuine broadcast to the tester list. Unlike the test send this records
  // everything, so a tester who opts out really is gone from the next one.
  bot.action(/^blast_testers:(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) {
      await answerCb(ctx);
      return;
    }

    const pending = getPendingBroadcast(ctx.match[1]);
    if (!pending) {
      await answerCb(ctx, "This draft has expired.");
      return;
    }

    const { configured, subscribed } = testerCounts();
    if (subscribed === 0) {
      await answerCb(
        ctx,
        configured === 0 ? "No beta testers configured." : "Every beta tester has opted out."
      );
      return;
    }

    await answerCb(ctx, "Sending to beta testers...");
    const { sent, failed } = await sendBroadcast(ctx.telegram, pending.text, { testersOnly: true });
    log("blast", `tester send: ${sent} sent, ${failed} failed`);

    await ctx.reply(
      `Sent to ${sent} beta tester${sent === 1 ? "" : "s"}${failed ? ` (${failed} failed)` : ""}. ` +
        "This was a real send, so anyone who taps Turn these off will be skipped next time.\n\n" +
        "The draft is still waiting — send it again to testers to check that, or Send to everyone when you're happy."
    );
  });

  bot.action(/^blast_cancel:(.+)$/, async (ctx) => {
    clearPendingBroadcast();
    await answerCb(ctx, "Cancelled.");
    await ctx.editMessageText("Broadcast cancelled — nothing was sent.");
  });
}
