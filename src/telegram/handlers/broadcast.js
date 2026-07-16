import { Markup } from "telegraf";
import { isAdmin } from "../isAdmin.js";
import { isAwaitingBroadcast, clearAwaitingBroadcast } from "../../store/broadcastState.js";
import { setPendingBroadcast, getPendingBroadcast, clearPendingBroadcast } from "../../store/pendingBroadcast.js";
import { getPrivateChatIds } from "../../store/knownChats.js";
import { config } from "../../config.js";
import { log } from "../../logger.js";

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
      await ctx.answerCbQuery();
      return;
    }

    const pending = getPendingBroadcast(ctx.match[1]);
    if (!pending) {
      await ctx.answerCbQuery("This draft has expired.");
      return;
    }

    await ctx.answerCbQuery("Sending...");
    clearPendingBroadcast();

    const chatIds = getPrivateChatIds().filter((id) => String(id) !== String(config.adminChatId));
    let sent = 0;
    let failed = 0;
    for (const chatId of chatIds) {
      try {
        await ctx.telegram.sendMessage(chatId, pending.text);
        sent += 1;
      } catch (error) {
        failed += 1;
        log("blast", `failed to send to ${chatId}: ${error.message}`);
      }
    }

    log("blast", `broadcast sent to ${sent}/${chatIds.length} chats (${failed} failed)`);
    await ctx.editMessageText(
      `📣 Broadcast sent to ${sent} chat(s)${failed ? ` (${failed} failed)` : ""}.`
    );
  });

  bot.action(/^blast_cancel:(.+)$/, async (ctx) => {
    clearPendingBroadcast();
    await ctx.answerCbQuery("Cancelled.");
    await ctx.editMessageText("Broadcast cancelled — nothing was sent.");
  });
}
