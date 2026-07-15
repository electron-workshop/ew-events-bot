import { Markup } from "telegraf";
import { listUpcomingEvents } from "../../services/calendar.js";
import { createEventRef } from "../../store/eventRefs.js";
import { config } from "../../config.js";
import { log } from "../../logger.js";

const RANGES = {
  today: { label: "next 24 hours", ms: 24 * 60 * 60 * 1000 },
  week: { label: "next 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  month: { label: "next 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
};

const MAX_EVENTS_SHOWN = 25;

// "en-CA" conveniently formats as YYYY-MM-DD, handy as a grouping key.
const DAY_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: config.timezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const DAY_HEADER_FORMAT = new Intl.DateTimeFormat("en-AU", {
  timeZone: config.timezone,
  weekday: "long",
  day: "numeric",
  month: "short",
});
const TIME_FORMAT = new Intl.DateTimeFormat("en-AU", {
  timeZone: config.timezone,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function eventStartDate(event) {
  return event.start.dateTime ? new Date(event.start.dateTime) : new Date(`${event.start.date}T00:00:00`);
}

function formatEventTime(event) {
  if (!event.start.dateTime) return "all day";
  const start = TIME_FORMAT.format(new Date(event.start.dateTime));
  const end = event.end?.dateTime ? TIME_FORMAT.format(new Date(event.end.dateTime)) : null;
  return end ? `${start}–${end}` : start;
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

    const lines = [`📅 Events in the ${range.label}:`];
    const buttons = [];
    let currentDayKey = null;
    let num = 0;

    for (const event of shown) {
      const startDate = eventStartDate(event);
      const dayKey = DAY_KEY_FORMAT.format(startDate);
      if (dayKey !== currentDayKey) {
        currentDayKey = dayKey;
        lines.push("", `── ${DAY_HEADER_FORMAT.format(startDate)} ──`);
      }

      num += 1;
      lines.push(`${num}. ${formatEventTime(event)}  ${event.summary}`);

      const ref = createEventRef(event.id);
      buttons.push(Markup.button.callback(`🔔 ${num}`, `remind:${ref}`));
    }

    if (events.length > shown.length) {
      lines.push("", `...and ${events.length - shown.length} more.`);
    }
    lines.push("", "Tap 🔔 below to get reminded before one of these.");

    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(buttons.slice(i, i + 5));
    }

    await ctx.reply(lines.join("\n"), Markup.inlineKeyboard(rows));
  };
}

export const handleToday = makeListHandler("today");
export const handleWeek = makeListHandler("week");
export const handleMonth = makeListHandler("month");
