import { hasPendingInChat } from "../../store/pendingEvents.js";
import { looksLikeFieldEdit } from "../fields.js";
import { log } from "../../logger.js";

// Commands worth suggesting. Admin-only ones are deliberately absent — someone
// who can't use /blast shouldn't be told it exists.
const PUBLIC_COMMANDS = [
  "start",
  "add_event",
  "view",
  "today",
  "tomorrow",
  "week",
  "month",
  "reminders",
  "feedback",
];

const URL_PATTERN = /https?:\/\/\S+/i;

const MENU =
  "• /add_event <link> — add an event to the calendar\n" +
  "• /today, /tomorrow, /week, /month — what's coming up\n" +
  "• /feedback — tell the EW team about a bug or an idea\n" +
  "• /start — everything I can do";

function editDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return rows[a.length][b.length];
}

// The closest real command, if it's close enough to be worth guessing at.
// "/feeback" should offer /feedback; "/xyzzy" shouldn't offer anything.
function closestCommand(typed) {
  let best = null;
  let bestDistance = Infinity;
  for (const command of PUBLIC_COMMANDS) {
    const distance = editDistance(typed, command);
    if (distance < bestDistance) {
      best = command;
      bestDistance = distance;
    }
  }
  // A third of the word can be wrong before we stop guessing, so short
  // commands need a closer match than long ones.
  return bestDistance <= Math.max(1, Math.ceil(best.length / 3)) ? best : null;
}

// Last handler in the chain. Before this existed, a DM that matched nothing
// got no reply and no log line, which is how the edit bug went unnoticed.
export function registerFallbackHandler(bot) {
  bot.on("text", async (ctx) => {
    // Only in DMs — a catch-all in a group would reply to every message.
    if (ctx.chat.type !== "private") return;

    const text = ctx.message.text;
    log("fallback", `unhandled text from ${ctx.from.id}: ${JSON.stringify(text.slice(0, 80))}`);

    // A mistyped command is the most common way to land here, and the person
    // already knows what they wanted — so name it rather than listing the menu.
    const typed = text.match(/^\/([a-z0-9_]+)/i);
    if (typed) {
      const suggestion = closestCommand(typed[1].toLowerCase());
      await ctx.reply(
        suggestion
          ? `I don't know /${typed[1]}. Did you mean /${suggestion}?`
          : `I don't know /${typed[1]}. Here's what I can do:\n\n${MENU}`
      );
      return;
    }

    // A bare link is someone trying to add an event without the command.
    if (URL_PATTERN.test(text)) {
      await ctx.reply(
        "Looks like an event link. Send it with /add_event in front and I'll add it to the calendar:\n\n" +
          `/add_event ${text.match(URL_PATTERN)[0]}`
      );
      return;
    }

    if (looksLikeFieldEdit(text)) {
      await ctx.reply(
        hasPendingInChat(ctx.chat.id)
          ? "That looks like event details, but I'm not editing anything right now. Tap Edit on the event above, then send them again."
          : "That looks like event details, but I don't have an event waiting — it may have expired. Send the link again with /add_event."
      );
      return;
    }

    await ctx.reply(`I'm not sure what you're after. Here's what I can do:\n\n${MENU}`);
  });
}
