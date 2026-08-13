import { config } from "../config.js";

// Renders a changelog entry as the plain-text release note the bot broadcasts.
// Broadcasts go out without a parse_mode, so no markdown here — Telegram
// auto-links a bare URL anyway.
export function formatReleaseNotes(entry) {
  // A draft has no version number yet, and "v Unreleased" would read worse
  // than saying plainly that it isn't cut.
  const isDraft = entry.version.toLowerCase() === "unreleased";
  const lines = [isDraft ? "⚡ Bot update (draft)" : `⚡ Bot update — v${entry.version}`];

  // Prefer the short, user-facing summary. Everything else in the entry is the
  // full record, which belongs in the changelog rather than in everyone's DMs.
  const highlights = entry.groups.find((group) => group.title?.toLowerCase() === "highlights");
  const groups = highlights ? [{ ...highlights, title: null }] : entry.groups;

  for (const group of groups) {
    lines.push("");
    if (group.title) lines.push(group.title);
    for (const item of group.items) {
      lines.push(`• ${item.replace(/`/g, "")}`);
    }
  }

  // Only when there's somewhere public to point at — a private repo would give
  // everyone a 404.
  if (highlights && config.changelogUrl) {
    lines.push("", `Full changelog: ${config.changelogUrl}`);
  }

  return lines.join("\n");
}
