import { Markup } from "telegraf";
import { isAdmin } from "../isAdmin.js";
import { version } from "../../version.js";
import { getChangelogEntry } from "../../services/changelog.js";
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

  const entry = getChangelogEntry(version);
  if (!entry || entry.groups.length === 0) {
    log("release", `no changelog entry for v${version}`);
    await ctx.reply(
      `I'm running v${version}, but CHANGELOG.md has nothing under "## [${version}]" yet.\n\n` +
        "Add the release notes there, restart the bot, then run /release again."
    );
    return;
  }

  const text = formatReleaseNotes(entry);
  const pending = setPendingBroadcast(text);
  log("release", `release notes for v${version} drafted by ${ctx.from.id}`);

  await ctx.reply(
    `Preview:\n\n${text}\n\nSend this to everyone who's messaged the bot?`,
    Markup.inlineKeyboard([
      Markup.button.callback("Send to everyone", `blast_confirm:${pending.id}`),
      Markup.button.callback("Cancel", `blast_cancel:${pending.id}`),
    ])
  );
}
