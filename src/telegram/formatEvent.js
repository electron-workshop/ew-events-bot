import { resolveEndTime, endsNextDay, dayCount } from "../services/eventTime.js";

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
  const days = fields.end_date ? dayCount(fields.date, fields.end_date) : 1;

  let timeLine = "— (all day)";
  if (fields.time) {
    const endTime = resolveEndTime(fields.time, fields.end_time);
    const notes = [];
    // Flag the guess, so an unstated finish time is obvious and correctable
    // rather than looking like something the page actually said.
    if (endTime !== fields.end_time) notes.push("end time estimated");
    if (endsNextDay(fields.time, endTime)) notes.push("ends next day");
    if (days > 1) notes.push("each day");
    timeLine = `${fields.time} – ${endTime}${notes.length ? ` (${notes.join(", ")})` : ""}`;
  }

  // Spell out the span rather than just showing two dates, so someone can tell
  // at a glance whether the bot understood a multi-day event correctly.
  const dateLine =
    days > 1
      ? `${fields.date} to ${fields.end_date} (${days} days)`
      : fields.date || "—";

  const lines = [
    `<b>Title:</b> ${escapeHtml(fields.title || "—")}`,
    `<b>Date:</b> ${escapeHtml(dateLine)}`,
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
  'end_date: 2026-08-02\n' +
  'time: 18:30\n' +
  'end_time: 20:00\n' +
  'location: Somewhere\n' +
  'description: ...\n' +
  'register_link: https://...\n\n' +
  'You only need to include the fields you want to change. ' +
  'Add end_date only if the event runs across several days.';
