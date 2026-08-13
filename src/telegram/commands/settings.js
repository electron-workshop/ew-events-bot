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
          ? Markup.button.callback("Turn these off", "sub_stop")
          : Markup.button.callback("Turn these on", "sub_keep"),
      ],
    ]),
  };
}

export async function handleSettings(ctx) {
  const { text, keyboard } = settingsMessage(ctx.chat.id);
  await ctx.reply(text, keyboard);
}

export function registerSubscriptionHandlers(bot) {
  // Reachable from two places: the buttons on someone's first broadcast, and
  // /settings. Both end up showing the same current state.
  async function setAndConfirm(ctx, subscribed) {
    setSubscribed(ctx.chat.id, subscribed);
    log("settings", `${ctx.chat.id} announcements ${subscribed ? "on" : "off"}`);

    await answerCb(ctx, subscribed ? "You'll keep getting these." : "Turned off.");

    const confirmation = subscribed
      ? "Announcements are on. Send /settings to change it."
      : "Announcements are off. Send /settings to turn them back on.";

    // Replaces the buttons rather than leaving them sitting in the chat.
    await ctx.editMessageText(confirmation).catch(async () => {
      await ctx.reply(confirmation);
    });
  }

  bot.action("sub_keep", (ctx) => setAndConfirm(ctx, true));
  bot.action("sub_stop", (ctx) => setAndConfirm(ctx, false));
}
