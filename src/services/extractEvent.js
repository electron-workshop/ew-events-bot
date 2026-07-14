import { config } from "../config.js";
import { log } from "../logger.js";

const REQUIRED_FIELDS = ["title", "date"];
const ALL_FIELDS = [
  "title",
  "description",
  "date",
  "time",
  "location",
  "register_link",
];

const SYSTEM_PROMPT = `You extract event details from webpage text. Respond with ONLY a JSON object with these exact keys: title, description, date, time, location, register_link. Use JSON null (not the string "null") for any field you cannot find — never guess or invent a value. Dates should be in YYYY-MM-DD format if a year is present; if no year is stated, assume the nearest upcoming occurrence. Times should be in 24-hour HH:MM format. register_link should be a URL if the page has a registration/RSVP/ticket link, otherwise the source page URL, otherwise null.`;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// The model occasionally emits the literal string "null" (or other junk)
// instead of a real JSON null. Normalize those away so callers only ever
// see a real null or a validly-shaped value.
function cleanField(key, value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed.toLowerCase() === "null") return null;
    if (key === "time" && !TIME_PATTERN.test(trimmed)) return null;
    return trimmed;
  }
  return value;
}

/**
 * Sends page text to the local Ollama model and returns extracted fields.
 * Returns { fields, complete } where `complete` is false if a required
 * field (title/date) is missing — callers should treat that as
 * "couldn't extract enough detail automatically".
 */
export async function extractEvent(pageText, sourceUrl) {
  log("ollama", `POST ${config.ollamaHost}/api/generate model=${config.ollamaModel}`);
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

  const fields = {};
  for (const key of ALL_FIELDS) {
    fields[key] = cleanField(key, parsed[key] ?? null);
  }

  const complete = REQUIRED_FIELDS.every((key) => fields[key]);

  return { fields, complete };
}
