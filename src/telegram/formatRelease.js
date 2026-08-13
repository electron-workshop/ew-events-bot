import { config } from "../config.js";

// Release notes are the one broadcast the bot composes itself, so unlike a
// /blast they can safely use HTML — that's what makes "changelog on GitHub" a
// link rather than a pasted URL. Everything interpolated is still escaped,
// because changelog text is hand-written and will eventually contain an "&".
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatReleaseNotes(entry) {
  // A draft has no version number yet, and "v Unreleased" would read worse
  // than saying plainly that it isn't cut.
  const isDraft = entry.version.toLowerCase() === "unreleased";
  const lines = [isDraft ? "⚡ Bot update (draft)" : `⚡ Bot update — v${escapeHtml(entry.version)}`];

  // Prefer the short, user-facing summary. Everything else in the entry is the
  // full record, which belongs in the changelog rather than in everyone's DMs.
  const highlights = entry.groups.find((group) => group.title?.toLowerCase() === "highlights");
  const groups = highlights ? [{ ...highlights, title: null }] : entry.groups;

  for (const group of groups) {
    lines.push("");
    if (group.title) lines.push(escapeHtml(group.title));
    for (const item of group.items) {
      lines.push(`• ${escapeHtml(item.replace(/`/g, ""))}`);
    }
  }

  // Only when there's somewhere public to point at — a private repo would give
  // everyone a 404.
  if (highlights && config.changelogUrl) {
    lines.push(
      "",
      `View full <a href="${escapeHtml(config.changelogUrl)}">changelog on GitHub</a>`
    );
  }

  return lines.join("\n");
}
