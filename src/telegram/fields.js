export const FIELD_KEYS = ["title", "date", "time", "location", "description", "register_link"];

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
