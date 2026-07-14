import { convert } from "html-to-text";
import { log } from "../logger.js";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_TEXT_LENGTH = 8_000; // keep prompt size sane for the LLM

const JSON_LD_PATTERN = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

// Many event platforms (Luma, Eventbrite, Meetup...) embed a schema.org
// Event block in a <script type="application/ld+json"> tag for search/social
// previews. It's far more reliable than scraped visible text — e.g. it has
// the real start/end timestamps even when the rendered page just says
// "Loading..." to a non-JS fetch. Find it if present.
function extractEventJsonLd(html) {
  let match;
  while ((match = JSON_LD_PATTERN.exec(html))) {
    let parsed;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      continue;
    }
    const candidates = Array.isArray(parsed) ? parsed : parsed["@graph"] || [parsed];
    for (const candidate of candidates) {
      const type = candidate?.["@type"];
      const isEvent = type === "Event" || (Array.isArray(type) && type.includes("Event"));
      if (isEvent) return candidate;
    }
  }
  return null;
}

function summarizeEventJsonLd(event) {
  const location = event.location;
  const locationParts = [];
  if (location?.name) locationParts.push(location.name);
  if (location?.address) {
    const addr = location.address;
    locationParts.push(
      [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode, addr.addressCountry]
        .filter(Boolean)
        .join(", ")
    );
  }

  const summary = {
    name: event.name,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    location: locationParts.filter(Boolean).join(" — ") || undefined,
    url: event.url,
  };

  return JSON.stringify(summary, null, 2);
}

/**
 * Fetches a URL and converts it to text for LLM extraction, preferring a
 * schema.org Event JSON-LD block (if present) over the rendered page text.
 * Returns null if the fetch fails or the page has no usable content at all
 * (e.g. a JS-rendered page with no structured data either) — callers should
 * treat that as "couldn't read this page automatically".
 */
export async function fetchPageText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; EWEventsBot/1.0; +https://electronworkshop.org)",
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return null;

  const html = await response.text();

  const eventJsonLd = extractEventJsonLd(html);
  if (eventJsonLd) {
    log("fetch", "found schema.org Event JSON-LD block on page");
  }

  const text = convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
      { selector: "nav", format: "skip" },
      { selector: "footer", format: "skip" },
      { selector: "img", format: "skip" },
      { selector: "a", options: { ignoreHref: false } },
    ],
  }).trim();

  if (text.length < 40 && !eventJsonLd) return null; // likely a JS-only shell with no content at all

  const parts = [];
  if (eventJsonLd) {
    parts.push(
      "Structured event data found on this page (schema.org Event JSON-LD). " +
        "Trust these fields over the page text below if they conflict:\n" +
        summarizeEventJsonLd(eventJsonLd)
    );
  }
  parts.push("Page text:\n" + text);

  return parts.join("\n\n").slice(0, MAX_TEXT_LENGTH);
}
