import { log } from "../logger.js";

const DEFAULT_DURATION_HOURS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** True if `value` is a 24-hour time written as HH:MM. */
export function isTimeKey(value) {
  return typeof value === "string" && TIME_KEY.test(value);
}

// "2026-09-22 to 2026-09-23", "2026-09-22 - 2026-09-23", en dash, or a slash.
const DATE_RANGE = /^(\d{4}-\d{2}-\d{2})\s*(?:to|until|through|[-–—/])\s*(\d{4}-\d{2}-\d{2})$/i;

/**
 * Splits "2026-09-22 to 2026-09-23" into both dates, or returns null if the
 * value isn't a range. Used both when the model packs a range into `date` and
 * when someone types one during an edit.
 */
export function parseDateRange(value) {
  const match = typeof value === "string" && value.match(DATE_RANGE);
  return match ? [match[1], match[2]] : null;
}

/** True if `value` is a real calendar date written as YYYY-MM-DD. */
export function isDateKey(value) {
  if (typeof value !== "string" || !DATE_KEY.test(value)) return false;
  // A pattern match isn't enough: 2026-02-31 parses fine and silently rolls
  // over into March, so round-trip it and insist we get the same day back.
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function toUtc(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Shifts a YYYY-MM-DD date key by `days`, returning a new key. */
export function addDays(dateKey, days) {
  return new Date(toUtc(dateKey) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * How many days an event covers, counting both ends — 22nd to 23rd is 2 days.
 * Returns 1 when there's no usable end date, so callers can treat every event
 * as a run of N days without special-casing the single-day one.
 */
export function dayCount(startKey, endKey) {
  if (!isDateKey(startKey) || !isDateKey(endKey)) return 1;
  const days = Math.round((toUtc(endKey) - toUtc(startKey)) / DAY_MS) + 1;
  // An end date before the start is bad data, not a zero-length event.
  return days > 1 ? days : 1;
}

/**
 * Given a "HH:MM" start time, returns the default end time (start + 2h) in
 * the same format. Returns null if there's no start time. Shared between
 * the calendar write and the Telegram preview so they never disagree.
 */
export function computeEndTime(time, durationHours = DEFAULT_DURATION_HOURS) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  const end = new Date(0);
  end.setUTCHours(hours + durationHours, minutes);
  return `${String(end.getUTCHours()).padStart(2, "0")}:${String(end.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * The end time to actually use: whatever the page said, falling back to the
 * two-hour default when it didn't say. An end time equal to the start is
 * treated as missing — pages that repeat the start time mean "we didn't say",
 * not "this event lasts no time at all".
 */
export function resolveEndTime(time, endTime) {
  if (!time) return null;
  if (isTimeKey(endTime) && endTime !== time) return endTime;
  return computeEndTime(time);
}

/**
 * True when the end time lands on the following day, e.g. a launch party
 * running 20:00–01:00. Both times are zero-padded HH:MM, so comparing them as
 * strings orders them correctly.
 */
export function endsNextDay(time, endTime) {
  return isTimeKey(time) && isTimeKey(endTime) && endTime < time;
}

/**
 * Tidies up the four scheduling fields so the calendar never sees a
 * combination it can't represent. The prompt asks for all of this, but the
 * model doesn't always comply and people can type anything in the edit flow.
 */
export function normalizeSchedule(fields) {
  const result = { ...fields };

  const range = parseDateRange(result.date);
  if (range) {
    log("schedule", `split date range "${result.date}" into ${range[0]} / ${range[1]}`);
    result.date = range[0];
    result.end_date = result.end_date || range[1];
  }

  // Equal dates mean single-day; an earlier end date is bad data. Either way
  // there's no span to represent.
  if (result.end_date && dayCount(result.date, result.end_date) === 1) {
    if (result.end_date !== result.date) {
      log("schedule", `ignoring end_date ${result.end_date}, not after date ${result.date}`);
    }
    result.end_date = null;
  }

  // An end time with nothing to end from can't be placed on the clock, and
  // would otherwise turn an all-day event into a timed one starting at
  // midnight.
  if (result.end_time && !result.time) {
    log("schedule", `ignoring end_time ${result.end_time}, no start time to pair it with`);
    result.end_time = null;
  }

  return result;
}
