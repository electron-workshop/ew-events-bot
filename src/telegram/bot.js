import { Telegraf } from "telegraf";
import { config } from "../config.js";
import { recordChat } from "../store/knownChats.js";
import { log } from "../logger.js";
import { handleAddEvent } from "./commands/addEvent.js";
import { handleStart } from "./commands/start.js";
import { handleView } from "./commands/view.js";
import { handleToday, handleTomorrow, handleWeek, handleMonth } from "./commands/listEvents.js";
import { handleReminders } from "./commands/reminders.js";
import { handleBlast } from "./commands/blast.js";
import { handleRelease } from "./commands/release.js";
import { handleFeedback } from "./commands/feedback.js";
import { handleSettings, registerSubscriptionHandlers } from "./commands/settings.js";
import { registerCallbackHandlers } from "./handlers/callbacks.js";
import { registerReplyHandler } from "./handlers/replies.js";
import { registerAwaitingLinkHandler } from "./handlers/awaitingLink.js";
import { registerReminderHandlers } from "./handlers/reminders.js";
import { registerBroadcastComposeHandler, registerBroadcastActionHandlers } from "./handlers/broadcast.js";
import {
  registerFeedbackComposeHandler,
  registerFeedbackActionHandlers,
  registerFeedbackChoiceHandlers,
  registerIssueComposeHandler,
} from "./handlers/feedback.js";
import { registerFallbackHandler } from "./handlers/fallback.js";

export function createBot() {
  const bot = new Telegraf(config.telegramBotToken);

  bot.use((ctx, next) => {
    if (ctx.chat) {
      const isNew = recordChat(ctx.chat.id, ctx.chat.type);
      // Logged once per chat, not per message. This is where you get someone's
      // numeric ID to put in BETA_TESTERS — ask them to message the bot, then
      // look for this line.
      if (isNew && ctx.from) {
        const label = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
        log("new_chat", `${label} (id ${ctx.from.id}) in ${ctx.chat.type} chat ${ctx.chat.id}`);
      }
    }
    return next();
  });

  bot.command("start", handleStart);
  bot.command("add_event", handleAddEvent);
  bot.command("view", handleView);
  bot.command("today", handleToday);
  bot.command("tomorrow", handleTomorrow);
  bot.command("week", handleWeek);
  bot.command("month", handleMonth);
  bot.command("reminders", handleReminders);
  bot.command("blast", handleBlast);
  bot.command("release", handleRelease);
  bot.command("feedback", handleFeedback);
  bot.command("settings", handleSettings);
  registerSubscriptionHandlers(bot);
  registerCallbackHandlers(bot);
  registerReminderHandlers(bot);
  registerBroadcastActionHandlers(bot);
  registerFeedbackActionHandlers(bot);
  registerFeedbackChoiceHandlers(bot);
  registerBroadcastComposeHandler(bot);
  registerIssueComposeHandler(bot);
  registerFeedbackComposeHandler(bot);
  registerReplyHandler(bot);
  registerAwaitingLinkHandler(bot);
  registerFallbackHandler(bot); // must stay last — it answers anything left over

  bot.catch((error, ctx) => {
    console.error("Unhandled bot error:", error);
    ctx.reply("Something went wrong handling that — please try again.").catch(() => {});
  });

  return bot;
}
