import { Markup } from "telegraf";
import { isSubscribed, setSubscribed } from "../../store/knownChats.js";
import { answerCb } from "../answerCb.js";
import { log } from "../../logger.js";

export function settingsMessage(chatId) {
  const on = isSubscribed(chatId);
  return {
    text:
      `Announcements: ${on ? "on" : "off"}\n\n` +
      (on
        ? "You'll get a message when the bot gets new features. There aren't many — roughly one per release."
        : "You won't get messages about new features. Event reminders you've set still work."),
    keyboard: Markup.inlineKeyboard([
      [
        on
          ? Markup.button.callback("Turn these off", "sub_stop:menu")
          : Markup.button.callback("Turn these on", "sub_keep:menu"),
      ],
    ]),
  };
}

export async function handleSettings(ctx) {
  const { text, keyboard } = settingsMessage(ctx.chat.id);
  await ctx.reply(text, keyboard);
}

export function registerSubscriptionHandlers(bot) {
  // The same two buttons appear in two places, and they have to behave
  // differently. On a broadcast the message is something the person was
  // reading, so only the buttons come off. In /settings the message *is* the
  // panel, so it's rewritten to show the new state.
  // The bare form (no ":origin") is what older broadcasts already sitting in
  // people's chats send, so it's treated as a broadcast.
  bot.action(/^sub_(keep|stop)(?::(bc|menu))?$/, async (ctx) => {
    const subscribed = ctx.match[1] === "keep";
    const fromMenu = ctx.match[2] === "menu";

    setSubscribed(ctx.chat.id, subscribed);
    log("settings", `${ctx.chat.id} announcements ${subscribed ? "on" : "off"} (via ${fromMenu ? "/settings" : "broadcast"})`);

    await answerCb(ctx, subscribed ? "You'll keep getting these." : "Turned off.");

    if (fromMenu) {
      const { text, keyboard } = settingsMessage(ctx.chat.id);
      await ctx.editMessageText(text, keyboard).catch(async () => {
        await ctx.reply(text, keyboard);
      });
      return;
    }

    // Leave the announcement itself intact — replacing it would delete the
    // thing they'd just tapped a button underneath.
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    await ctx.reply(
      subscribed
        ? "Got it — you'll keep getting these. Send /settings to change it."
        : "Done, no more update messages. Send /settings to turn them back on."
    );
  });
}
