import { Markup } from "telegraf";
import { listUpcomingEvents } from "../../services/calendar.js";
import { log } from "../../logger.js";

const RANGES = {
  today: { label: "next 24 hours", ms: 24 * 60 * 60 * 1000 },
  week: { label: "next 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  month: { label: "next 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
};

const MAX_EVENTS_SHOWN = 25;

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const TIME_FORMAT = new Intl.DateTimeFormat("en-AU", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatEventLine(event) {
  if (event.start.date) {
    return `${WEEKDAY_FORMAT.format(new Date(event.start.date))} (all day) — ${event.summary}`;
  }
  const start = new Date(event.start.dateTime);
  return `${WEEKDAY_FORMAT.format(start)}, ${TIME_FORMAT.format(start)} — ${event.summary}`;
}

function makeListHandler(rangeKey) {
  const range = RANGES[rangeKey];

  return async function handleList(ctx) {
    log("list_events", `${rangeKey} requested by ${ctx.from.id} in chat ${ctx.chat.id}`);

    const now = new Date();
    const events = await listUpcomingEvents(now, new Date(now.getTime() + range.ms));

    if (events.length === 0) {
      await ctx.reply(`No upcoming events in the ${range.label}.`);
      return;
    }

    const shown = events.slice(0, MAX_EVENTS_SHOWN);
    const lines = shown.map((event, i) => `${i + 1}. ${formatEventLine(event)}`);
    const text =
      `Events in the ${range.label}:\n\n${lines.join("\n")}` +
      (events.length > shown.length ? `\n\n...and ${events.length - shown.length} more.` : "") +
      `\n\nTap 🔔 to get reminded before one of these.`;

    const buttons = shown.map((event, i) =>
      Markup.button.callback(`🔔 ${i + 1}`, `remind:${event.id}`)
    );
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(buttons.slice(i, i + 5));
    }

    await ctx.reply(text, Markup.inlineKeyboard(rows));
  };
}

export const handleToday = makeListHandler("today");
export const handleWeek = makeListHandler("week");
export const handleMonth = makeListHandler("month");
