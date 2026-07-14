export function formatFieldsSummary(fields) {
  const lines = [
    `*Title:* ${fields.title || "—"}`,
    `*Date:* ${fields.date || "—"}`,
    `*Time:* ${fields.time || "—"}`,
    `*Location:* ${fields.location || "—"}`,
    `*Register link:* ${fields.register_link || "—"}`,
  ];
  if (fields.description) {
    lines.push(`*Description:* ${fields.description}`);
  }
  return lines.join("\n");
}

export const EDIT_INSTRUCTIONS =
  'Reply to this message with corrected details, one per line, e.g.:\n' +
  'title: New title\n' +
  'date: 2026-08-01\n' +
  'time: 18:30\n' +
  'location: Somewhere\n' +
  'description: ...\n' +
  'register_link: https://...\n\n' +
  'You only need to include the fields you want to change.';
