import { computeEndTime } from "../services/eventTime.js";

export function formatFieldsSummary(fields) {
  const timeLine = fields.time
    ? `${fields.time} – ${computeEndTime(fields.time)}`
    : "— (all day)";

  const lines = [
    `*Title:* ${fields.title || "—"}`,
    `*Date:* ${fields.date || "—"}`,
    `*Time:* ${timeLine}`,
    `*Location:* ${fields.location || "—"}`,
    `*Register link:* ${fields.register_link || "—"}`,
  ];
  if (fields.description) {
    lines.push(`*Description:* ${fields.description}`);
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
