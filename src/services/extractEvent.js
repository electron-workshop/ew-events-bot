import { config } from "../config.js";
import { log } from "../logger.js";
import { isDateKey, dayCount, parseDateRange } from "./eventTime.js";

const REQUIRED_FIELDS = ["title", "date"];
const ALL_FIELDS = [
  "title",
  "description",
  "date",
  "end_date",
  "time",
  "end_time",
  "location",
  "register_link",
];

const SYSTEM_PROMPT = `You extract event details from webpage text. Respond with ONLY a JSON object with these exact keys: title, description, date, end_date, time, end_time, location, register_link. Use JSON null (not the string "null") for any field you cannot find — never guess or invent a value. Dates should be in YYYY-MM-DD format if a year is present; if no year is stated, assume the nearest upcoming occurrence. Times should be in 24-hour HH:MM format. register_link should be a URL if the page has a registration/RSVP/ticket link, otherwise the source page URL, otherwise null.

date is the first day the event runs. end_date is the last day it runs, and must be null for a single-day event — only set it when the page clearly says the event spans several days (e.g. "22-23 September", "Friday to Sunday", "Day 1 / Day 2"). Never put a range in the date field; split it across date and end_date.

time is the daily start time and end_time is the daily finish time — the hours it runs on each day it runs, not a span from the first day to the last. Pages usually write these as a range: "6:45 PM to 7:45 PM" means time "18:45" and end_time "19:45"; "9am-5pm" means time "09:00" and end_time "17:00". Set end_time to null only when the page genuinely does not say when it finishes. If the finish time is earlier in the day than the start (e.g. "8pm till late, 1am"), that is fine — report it as written and do not adjust it.

If the page provides "Structured event data" with a startDate/endDate in ISO 8601 format (e.g. "2026-07-14T17:00:00.000+10:00"), that is the authoritative source — take the dates and times-of-day exactly as written in it (ignore the timezone offset, just read the local wall-clock date and time shown), and prefer it over anything mentioned in the page text. Its startDate gives date and time; its endDate gives end_time, and also end_date if it falls on a later day than the startDate.`;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// The model occasionally emits the literal string "null" (or other junk)
// instead of a real JSON null. Normalize those away so callers only ever
// see a real null or a validly-shaped value.
function cleanField(key, value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed.toLowerCase() === "null") return null;
    if ((key === "time" || key === "end_time") && !TIME_PATTERN.test(trimmed)) return null;
    // A malformed end_date would silently become a wrong recurrence length, so
    // drop it and let the event be single-day rather than guess at the span.
    if (key === "end_date" && !isDateKey(trimmed)) return null;
    return trimmed;
  }
  return value;
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
    log("extract", `split date range "${result.date}" into ${range[0]} / ${range[1]}`);
    result.date = range[0];
    result.end_date = result.end_date || range[1];
  }

  // Equal dates mean single-day; an earlier end date is bad data. Either way
  // there's no span to represent.
  if (result.end_date && dayCount(result.date, result.end_date) === 1) {
    if (result.end_date !== result.date) {
      log("extract", `ignoring end_date ${result.end_date}, not after date ${result.date}`);
    }
    result.end_date = null;
  }

  // An end time with nothing to end from can't be placed on the clock, and
  // would otherwise turn an all-day event into a timed one starting at
  // midnight.
  if (result.end_time && !result.time) {
    log("extract", `ignoring end_time ${result.end_time}, no start time to pair it with`);
    result.end_time = null;
  }

  return result;
}

/**
 * Sends page text to the local Ollama model and returns extracted fields.
 * Returns { fields, complete } where `complete` is false if a required
 * field (title/date) is missing — callers should treat that as
 * "couldn't extract enough detail automatically".
 */
export async function extractEvent(pageText, sourceUrl) {
  log("ollama", `POST ${config.ollamaHost}/api/generate model=${config.ollamaModel}`);
  log("ollama", `page text sent to model (${pageText.length} chars):\n${pageText}`);
  const response = await fetch(`${config.ollamaHost}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ollamaModel,
      system: SYSTEM_PROMPT,
      prompt: `Source URL: ${sourceUrl}\n\nPage text:\n${pageText}`,
      format: "json",
      stream: false,
      think: false,
      // Extraction should be deterministic, not creative — same page in
      // should reliably give the same fields out.
      options: { temperature: 0, seed: 42 },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    log("ollama", `request failed: ${response.status} ${response.statusText} — ${body}`);
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const { context, ...dataWithoutContext } = data;
  log(
    "ollama",
    `response (context omitted, ${Array.isArray(context) ? context.length : 0} tokens):\n` +
      JSON.stringify(dataWithoutContext, null, 2)
  );

  const rawText = data.response ?? "";
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    log(
      "ollama",
      `couldn't parse response as JSON — done=${data.done}, done_reason=${data.done_reason}, response length=${rawText.length}\nraw "response" field:\n${rawText}`
    );
    throw new Error("Ollama returned non-JSON output");
  }
  log("ollama", "parsed fields:\n" + JSON.stringify(parsed, null, 2));

  const raw = {};
  for (const key of ALL_FIELDS) {
    raw[key] = cleanField(key, parsed[key] ?? null);
  }
  const fields = normalizeSchedule(raw);

  const complete = REQUIRED_FIELDS.every((key) => fields[key]);

  return { fields, complete };
}
