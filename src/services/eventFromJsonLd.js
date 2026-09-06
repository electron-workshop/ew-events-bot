import { convert } from "html-to-text";
import { isDateKey, isTimeKey } from "./eventTime.js";
import { normalizeSchedule } from "./eventTime.js";
import { log } from "../logger.js";

// Long enough to keep a real description, short enough that the Telegram
// preview stays well inside the 4096-character message limit.
const MAX_DESCRIPTION_LENGTH = 1500;

// schema.org writes these as ISO 8601, usually with an offset:
// "2026-07-14T17:00:00.000+10:00". The offset is deliberately ignored and the
// wall-clock date and time read exactly as written — calendar.js attaches
// config.timezone when it writes the event, and the extraction prompt gives
// the model the same rule, so both paths read a page the same way.
const ISO_DATETIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/;

function splitIsoDateTime(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();

  const match = trimmed.match(ISO_DATETIME);
  if (match) {
    const [, date, hours, minutes] = match;
    const time = `${hours}:${minutes}`;
    return {
      date: isDateKey(date) ? date : null,
      time: isTimeKey(time) ? time : null,
    };
  }

  // A bare date with no time of day is how an all-day event is written.
  return isDateKey(trimmed) ? { date: trimmed, time: null } : null;
}

/**
 * Descriptions routinely arrive as HTML, and occasionally as HTML that was
 * escaped into the JSON. Flatten either into plain text.
 */
function cleanText(value, maxLength) {
  if (typeof value !== "string") return null;
  const text = convert(value, {
    wordwrap: false,
    // The registration URL is captured separately, so inline link targets are
    // noise here — keep the readable label and drop the href.
    selectors: [{ selector: "a", options: { ignoreHref: true } }],
  }).trim();
  if (!text) return null;
  if (maxLength && text.length > maxLength) return `${text.slice(0, maxLength).trimEnd()}…`;
  return text;
}

function formatPlace(place) {
  if (typeof place === "string") return place.trim() || null;
  if (!place || typeof place !== "object") return null;

  // An online event carries a VirtualLocation whose url is the whole location.
  const type = place["@type"];
  const isVirtual = type === "VirtualLocation" || (Array.isArray(type) && type.includes("VirtualLocation"));
  if (isVirtual) return cleanText(place.name) || (typeof place.url === "string" ? place.url.trim() : null);

  const parts = [];
  const name = cleanText(place.name);
  if (name) parts.push(name);

  const address = place.address;
  if (typeof address === "string") {
    parts.push(address.trim());
  } else if (address && typeof address === "object") {
    // Platforms often repeat the suburb and state inside streetAddress as well
    // as in their own fields, which reads as "…Parkville, VIC 3010, Parkville,
    // VIC". Keep the first mention of each and drop the echoes.
    const seen = [];
    for (const value of [
      address.streetAddress,
      address.addressLocality,
      address.addressRegion,
      address.postalCode,
      address.addressCountry,
    ]) {
      if (typeof value !== "string" || !value.trim()) continue;
      const piece = value.trim();
      if (seen.some((kept) => kept.toLowerCase().includes(piece.toLowerCase()))) continue;
      seen.push(piece);
    }
    if (seen.length) parts.push(seen.join(", "));
  }

  return parts.filter(Boolean).join(" — ") || null;
}

/** Hybrid events list several locations; join whatever is usable. */
function formatLocation(location) {
  const places = (Array.isArray(location) ? location : [location]).map(formatPlace).filter(Boolean);
  // The same venue sometimes appears twice (once as Place, once as text).
  return [...new Set(places)].join(" / ") || null;
}

/**
 * The ticketing/RSVP URL if the page offers one, otherwise the event's own
 * canonical URL, otherwise the link we were given. Mirrors what the extraction
 * prompt asks the model for.
 */
function findRegisterLink(event, sourceUrl) {
  const offers = Array.isArray(event.offers) ? event.offers : [event.offers];
  for (const offer of offers) {
    const url = typeof offer === "string" ? offer : offer?.url;
    if (typeof url === "string" && /^https?:\/\//i.test(url.trim())) return url.trim();
  }
  if (typeof event.url === "string" && /^https?:\/\//i.test(event.url.trim())) return event.url.trim();
  return sourceUrl || null;
}

/**
 * Builds event fields straight from a schema.org Event block, with no model in
 * the loop. Luma, Eventbrite, Meetup and most event platforms publish one, and
 * it carries the real start/end timestamps — so when it's there it is both
 * faster and more accurate than asking an LLM to re-read the same facts.
 *
 * Returns `{ fields, complete }`, or null when the block is missing a title or
 * a usable start date — the shape matches the model path in ew-events-webapp,
 * so a caller with both can treat them interchangeably.
 */
export function eventFromJsonLd(event, sourceUrl) {
  if (!event || typeof event !== "object") return null;

  const title = cleanText(event.name);
  const start = splitIsoDateTime(event.startDate);
  if (!title || !start?.date) {
    log("jsonld", `structured data missing ${!title ? "name" : "usable startDate"}, falling back to the model`);
    return null;
  }

  const end = splitIsoDateTime(event.endDate);

  // normalizeSchedule does the rest of the tidying both paths need: dropping an
  // end_date that isn't actually a later day, and an end_time with no start to
  // pair with (an all-day event whose endDate still carried a time of day).
  const fields = normalizeSchedule({
    title,
    description: cleanText(event.description, MAX_DESCRIPTION_LENGTH),
    date: start.date,
    end_date: end?.date || null,
    time: start.time,
    end_time: end?.time || null,
    location: formatLocation(event.location),
    register_link: findRegisterLink(event, sourceUrl),
  });

  log("jsonld", `built event from structured data: "${fields.title}" on ${fields.date}`);
  return { fields, complete: true };
}
