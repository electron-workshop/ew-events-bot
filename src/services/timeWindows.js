import { config } from "../config.js";

const DAY_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone });

function addDaysToKey(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Returns the UTC instant for local midnight on `dateKey` (YYYY-MM-DD) in
// `timeZone`, using actual zone data so DST transitions are handled correctly
// (rather than assuming a fixed UTC offset).
function zonedMidnight(dateKey, timeZone) {
  const guess = new Date(`${dateKey}T00:00:00Z`);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
  const asIfUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return new Date(guess.getTime() + (guess.getTime() - asIfUTC));
}

/**
 * Returns { start, end } Date objects spanning one full calendar day in the
 * configured timezone, `offsetDays` from today (0 = today, 1 = tomorrow).
 */
export function getDayWindow(offsetDays) {
  const todayKey = DAY_KEY_FORMAT.format(new Date());
  const startKey = addDaysToKey(todayKey, offsetDays);
  const endKey = addDaysToKey(todayKey, offsetDays + 1);
  return {
    start: zonedMidnight(startKey, config.timezone),
    end: zonedMidnight(endKey, config.timezone),
  };
}
