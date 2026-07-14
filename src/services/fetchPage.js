import { convert } from "html-to-text";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_TEXT_LENGTH = 8_000; // keep prompt size sane for the LLM

/**
 * Fetches a URL and converts it to plain text for LLM extraction.
 * Returns null if the fetch fails or the page has no usable text
 * (e.g. a JS-rendered page that returns an empty shell) — callers
 * should treat that as "couldn't read this page automatically".
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

  if (text.length < 40) return null; // likely a JS-only shell with no content

  return text.slice(0, MAX_TEXT_LENGTH);
}
