import { computeEndTime } from "../services/eventTime.js";

// These values come from a web page via an LLM, so they routinely contain
// characters that break a parse mode. HTML needs only these three escaped,
// unlike Markdown where a lone "_" in a URL (utm_source=...) is enough to
// make Telegram reject the whole message.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatFieldsSummary(fields) {
  const timeLine = fields.time
    ? `${fields.time} – ${computeEndTime(fields.time)}`
    : "— (all day)";

  const lines = [
    `<b>Title:</b> ${escapeHtml(fields.title || "—")}`,
    `<b>Date:</b> ${escapeHtml(fields.date || "—")}`,
    `<b>Time:</b> ${escapeHtml(timeLine)}`,
    `<b>Location:</b> ${escapeHtml(fields.location || "—")}`,
    `<b>Register link:</b> ${escapeHtml(fields.register_link || "—")}`,
  ];
  if (fields.description) {
    lines.push(`<b>Description:</b> ${escapeHtml(fields.description)}`);
  }
  return lines.join("\n");
}

export const EDIT_INSTRUCTIONS =
  'Send me the corrected details, one per line, e.g.:\n' +
  'title: New title\n' +
  'date: 2026-08-01\n' +
  'time: 18:30\n' +
  'location: Somewhere\n' +
  'description: ...\n' +
  'register_link: https://...\n\n' +
  'You only need to include the fields you want to change.';
