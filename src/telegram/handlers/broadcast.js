import { Markup } from "telegraf";
import { isAdmin } from "../isAdmin.js";
import { isAwaitingBroadcast, clearAwaitingBroadcast } from "../../store/broadcastState.js";
import { setPendingBroadcast, getPendingBroadcast, clearPendingBroadcast } from "../../store/pendingBroadcast.js";
import { sendBroadcast } from "../sendBroadcast.js";
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

    await ctx.reply(
      `Preview:\n\n${text}\n\nSend this to everyone who's messaged the bot?`,
      Markup.inlineKeyboard([
        Markup.button.callback("Send to everyone", `blast_confirm:${pending.id}`),
        Markup.button.callback("Cancel", `blast_cancel:${pending.id}`),
      ])
    );
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

  bot.action(/^blast_cancel:(.+)$/, async (ctx) => {
    clearPendingBroadcast();
    await answerCb(ctx, "Cancelled.");
    await ctx.editMessageText("Broadcast cancelled — nothing was sent.");
  });
}
