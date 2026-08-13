// Renders a changelog entry as the plain-text release note the bot broadcasts.
// Broadcasts go out without a parse_mode, so no markdown here.
export function formatReleaseNotes(entry) {
  // A draft has no version number yet — saying "v Unreleased" would be worse
  // than not naming one, and testers know what they're looking at anyway.
  const isDraft = entry.version.toLowerCase() === "unreleased";
  const lines = [isDraft ? "⚡ Bot update" : `⚡ Bot update — v${entry.version}`];

  for (const group of entry.groups) {
    lines.push("");
    if (group.title) lines.push(group.title);
    for (const item of group.items) {
      lines.push(`• ${item.replace(/`/g, "")}`);
    }
  }

  return lines.join("\n");
}
