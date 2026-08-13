import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const changelogPath = fileURLToPath(new URL("../../CHANGELOG.md", import.meta.url));

// "## [0.2.0] - 2026-08-10" or "## [Unreleased]"
const VERSION_HEADING = /^##\s+\[([^\]]+)\]\s*(?:-\s*(\S+))?\s*$/;
// "### Added"
const GROUP_HEADING = /^###\s+(.+?)\s*$/;
const BULLET = /^[-*]\s+(.+)$/;

function parseGroups(lines) {
  const groups = [];
  let current = null;

  for (const line of lines) {
    const heading = GROUP_HEADING.exec(line);
    if (heading) {
      current = { title: heading[1], items: [] };
      groups.push(current);
      continue;
    }

    const bullet = BULLET.exec(line.trim());
    if (bullet) {
      // Bullets before any "### Group" heading still belong somewhere.
      if (!current) {
        current = { title: null, items: [] };
        groups.push(current);
      }
      current.items.push(bullet[1]);
      continue;
    }

    // Wrapped continuation of the previous bullet.
    if (line.trim() && current?.items.length && /^\s+/.test(line)) {
      current.items[current.items.length - 1] += ` ${line.trim()}`;
    }
  }

  return groups.filter((group) => group.items.length > 0);
}

// Every "## [version]" section in file order, newest first.
export function parseChangelog(source = readFileSync(changelogPath, "utf8")) {
  const lines = source.split("\n");
  const entries = [];
  let current = null;

  for (const line of lines) {
    const heading = VERSION_HEADING.exec(line);
    if (heading) {
      current = { version: heading[1], date: heading[2] || null, lines: [] };
      entries.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }

  return entries.map(({ version, date, lines: body }) => ({
    version,
    date,
    groups: parseGroups(body),
  }));
}

// The entry for a specific version, or null if it isn't in the changelog yet.
export function getChangelogEntry(version) {
  return parseChangelog().find((entry) => entry.version === version) || null;
}

// The notes for the next release, still being written. Used by /release draft
// so testers can read the announcement before the version is cut.
export function getUnreleasedEntry() {
  return (
    parseChangelog().find((entry) => entry.version.toLowerCase() === "unreleased") || null
  );
}
