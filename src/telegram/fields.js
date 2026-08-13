import { isDateKey, isTimeKey, parseDateRange } from "../services/eventTime.js";

export const FIELD_KEYS = [
  "title",
  "date",
  "end_date",
  "time",
  "end_time",
  "location",
  "description",
  "register_link",
];

// Pulls "field: value" lines out of a message. Tolerant of capitalisation and
// of "Register link:" written with a space instead of an underscore.
export function parseFieldLines(text) {
  const updates = {};
  for (const line of text.split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim().toLowerCase().replace(/\s+/g, "_");
    const value = line.slice(separatorIndex + 1).trim();

    if (FIELD_KEYS.includes(key) && value) {
      updates[key] = value;
    }
  }
  return updates;
}

export function looksLikeFieldEdit(text) {
  return Object.keys(parseFieldLines(text)).length > 0;
}

// Dates and times have to be machine-readable; everything else is free text.
const VALIDATORS = {
  date: (value) => isDateKey(value) || Boolean(parseDateRange(value)),
  end_date: isDateKey,
  time: isTimeKey,
  end_time: isTimeKey,
};

export const FIELD_FORMATS = {
  date: "a date like 2026-08-01",
  end_date: "a date like 2026-08-02",
  time: "a 24-hour time like 18:30",
  end_time: "a 24-hour time like 20:00",
};

/**
 * Separates edits we can act on from ones we can't. Storing "5pm" would leave
 * the draft looking edited while the calendar quietly ignored it, so these are
 * held back and named in the reply instead.
 */
export function splitInvalidFields(updates) {
  const valid = {};
  const rejected = [];
  for (const [key, value] of Object.entries(updates)) {
    const isValid = VALIDATORS[key];
    if (isValid && !isValid(value)) rejected.push(key);
    else valid[key] = value;
  }
  return { valid, rejected };
}
