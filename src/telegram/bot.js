import { Telegraf } from "telegraf";
import { config } from "../config.js";
import { handleAddEvent } from "./commands/addEvent.js";
import { handleStart } from "./commands/start.js";
import { handleToday, handleWeek, handleMonth } from "./commands/listEvents.js";
import { registerCallbackHandlers } from "./handlers/callbacks.js";
import { registerReplyHandler } from "./handlers/replies.js";
import { registerAwaitingLinkHandler } from "./handlers/awaitingLink.js";
import { registerReminderHandlers } from "./handlers/reminders.js";

export function createBot() {
  const bot = new Telegraf(config.telegramBotToken);

  bot.command("start", handleStart);
  bot.command("add_event", handleAddEvent);
  bot.command("today", handleToday);
  bot.command("week", handleWeek);
  bot.command("month", handleMonth);
  registerCallbackHandlers(bot);
  registerReminderHandlers(bot);
  registerReplyHandler(bot);
  registerAwaitingLinkHandler(bot);

  bot.catch((error, ctx) => {
    console.error("Unhandled bot error:", error);
    ctx.reply("Something went wrong handling that — please try again.").catch(() => {});
  });

  return bot;
}
