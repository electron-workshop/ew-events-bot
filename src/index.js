import { createBot } from "./telegram/bot.js";

const bot = createBot();

bot.launch();
console.log("EW Events Bot is running.");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
