import { createBot } from "./telegram/bot.js";
import { config } from "./config.js";
import { log } from "./logger.js";
import { startReminderScheduler } from "./services/reminderScheduler.js";
import { dataDir } from "./store/dataDir.js";
import { version } from "./version.js";

const bot = createBot();

bot.launch();
startReminderScheduler(bot);
log(
  "startup",
  `calendar: ${config.googleCalendarId}, timezone: ${config.timezone}, ` +
    `admin notify: ${config.adminChatId ? "on" : "off"}, ` +
    `mini app: ${config.miniAppUrl || "not set"}, data: ${dataDir}`
);
console.log(`EW Events Bot v${version} is running.`);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
