import { createBot } from "./telegram/bot.js";
import { config } from "./config.js";
import { log } from "./logger.js";

const bot = createBot();

bot.launch();
log(
  "startup",
  `Ollama: ${config.ollamaHost} (${config.ollamaModel}), calendar: ${config.googleCalendarId}, timezone: ${config.timezone}, admin notify: ${config.adminChatId ? "on" : "off"}`
);
console.log("EW Events Bot is running.");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
