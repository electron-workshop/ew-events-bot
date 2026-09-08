import { log } from "../logger.js";

// The list behind Telegram's menu button. Telegram remembers whatever it was
// last told, so this used to drift: a command shipped, and the menu only caught
// up when someone remembered to run /setcommands in BotFather. Sending it on
// every startup means the menu is whatever this version of the code actually
// has, and shipping a command is enough to publish it.
//
// Admin commands are deliberately absent. /blast and /release message every
// user, so they stay unlisted and typed from memory. Nothing here gates them:
// isAdmin.js does that, and it does not care whether a command is in the menu.
const COMMANDS = [
  { command: "start", description: "What this bot does, and open the events app" },
  { command: "add_event", description: "Add an event from a link" },
  { command: "today", description: "What's on today" },
  { command: "tomorrow", description: "What's on tomorrow" },
  { command: "week", description: "What's on this week" },
  { command: "month", description: "What's on this month" },
  { command: "view", description: "Get the calendar link" },
  { command: "reminders", description: "See and cancel your reminders" },
  { command: "feedback", description: "Report a bug or suggest an idea" },
  { command: "settings", description: "Choose whether you get update messages" },
];

export async function syncCommandMenu(bot) {
  try {
    await bot.telegram.setMyCommands(COMMANDS);
    log("menu", `published ${COMMANDS.length} commands`);
  } catch (error) {
    // A failed menu update is cosmetic. The commands themselves still work
    // when typed, so this must never stop the bot starting.
    log("menu", `couldn't publish the command list: ${error.message}`);
  }
}
