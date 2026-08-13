import { isAdmin } from "../isAdmin.js";
import { broadcastPreview } from "../sendBroadcast.js";
import { version } from "../../version.js";
import { getChangelogEntry, getUnreleasedEntry } from "../../services/changelog.js";
import { formatReleaseNotes } from "../formatRelease.js";
import { setPendingBroadcast } from "../../store/pendingBroadcast.js";
import { log } from "../../logger.js";

// Drafts the current version's changelog entry as a broadcast, then hands off
// to the same preview/confirm buttons /blast uses.
export async function handleRelease(ctx) {
  if (!isAdmin(ctx)) {
    log("release", `unauthorized /release attempt by ${ctx.from.id}`);
    await ctx.reply("This command is only available to the bot admin.");
    return;
  }

  // "/release draft" reads the notes still under [Unreleased], so testers can
  // read the announcement before the version is cut.
  const wantsDraft = /^\/release(@\S+)?\s+(draft|unreleased)\b/i.test(ctx.message.text || "");

  const entry = wantsDraft ? getUnreleasedEntry() : getChangelogEntry(version);
  if (!entry || entry.groups.length === 0) {
    if (wantsDraft) {
      log("release", "no unreleased notes to draft");
      await ctx.reply(
        'CHANGELOG.md has nothing under "## [Unreleased]" yet.\n\n' +
          "Add the notes there and restart the bot, then run /release draft again."
      );
      return;
    }
    log("release", `no changelog entry for v${version}`);
    await ctx.reply(
      `I'm running v${version}, but CHANGELOG.md has nothing under "## [${version}]" yet.\n\n` +
        "Add the release notes there, restart the bot, then run /release again.\n\n" +
        "If you haven't cut the version yet, /release draft previews the unreleased notes."
    );
    return;
  }

  const text = formatReleaseNotes(entry);
  const pending = setPendingBroadcast(text, { draft: wantsDraft, html: true });
  log("release", `${wantsDraft ? "draft" : `v${version}`} notes drafted by ${ctx.from.id}`);

  const preview = broadcastPreview(text, pending.id, { draft: wantsDraft, html: true });
  await ctx.reply(preview.text, preview.keyboard);
}
