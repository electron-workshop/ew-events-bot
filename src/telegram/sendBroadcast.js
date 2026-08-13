import { Markup } from "telegraf";
import {
  getBroadcastChatIds,
  getBroadcastStats,
  getPrivateChats,
  needsBroadcastPrompt,
  markBroadcastPrompted,
} from "../store/knownChats.js";
import { config } from "../config.js";
import { log } from "../logger.js";

// Goes on every broadcast, so someone who ignored the buttons long ago still
// has a visible way out without having to remember a command exists.
const FOOTER = "\n\n—\nChange your broadcast preferences: /settings";

const PROMPT_KEYBOARD = Markup.inlineKeyboard([
  [
    Markup.button.callback("Keep sending these", "sub_keep"),
    Markup.button.callback("Turn these off", "sub_stop"),
  ],
]);

/**
 * Sends `text` to everyone still subscribed — including the admin, who is a
 * recipient like anyone else so they can see what actually went out. The first
 * broadcast a person receives carries the opt-out buttons; after that it's the
 * footer alone.
 *
 * `onlyChatId` restricts delivery to a single chat, for a test send. Those
 * force the buttons on (the point is to see what a newcomer sees) and don't
 * record the prompt, so a real first broadcast still offers the choice.
 *
 * Returns { sent, failed, prompted }.
 */
const isTester = (chatId) => config.betaTesters.includes(String(chatId));

/**
 * Works out who gets this and, just as usefully, who doesn't and why — so the
 * log can show that "to me only" and "to testers" really do differ.
 */
function planRecipients({ onlyChatId, testersOnly }) {
  if (onlyChatId !== null) {
    return { mode: "the admin only", recipients: [Number(onlyChatId)], skipped: [] };
  }

  const recipients = [];
  const skipped = [];
  for (const chat of getPrivateChats()) {
    if (!chat.subscribed) {
      skipped.push({ id: chat.id, why: "opted out" });
    } else if (testersOnly && !isTester(chat.id)) {
      skipped.push({ id: chat.id, why: "not a beta tester" });
    } else {
      recipients.push(chat.id);
    }
  }
  return { mode: testersOnly ? "beta testers" : "everyone", recipients, skipped };
}

export async function sendBroadcast(telegram, text, { onlyChatId = null, testersOnly = false } = {}) {
  const isTest = onlyChatId !== null;
  const { mode, recipients, skipped } = planRecipients({ onlyChatId, testersOnly });

  const count = recipients.length;
  log(
    "broadcast",
    `── sending to ${mode}: ${count} recipient${count === 1 ? "" : "s"}, ${skipped.length} skipped`
  );

  let sent = 0;
  let failed = 0;
  let prompted = 0;

  for (const chatId of recipients) {
    const withPrompt = isTest || needsBroadcastPrompt(chatId);
    const tag = isTester(chatId) ? " [tester]" : "";
    try {
      await telegram.sendMessage(chatId, text + FOOTER, withPrompt ? PROMPT_KEYBOARD : undefined);
      sent += 1;
      // Only after it actually arrived — otherwise someone who has blocked the
      // bot would be marked as asked without ever having seen the question.
      if (withPrompt && !isTest) {
        markBroadcastPrompted(chatId);
        prompted += 1;
      }
      const buttons = withPrompt
        ? isTest
          ? " + opt-out buttons (forced, not recorded)"
          : " + opt-out buttons (first broadcast)"
        : "";
      log("broadcast", `   ✓ ${chatId}${tag} delivered${buttons}`);
    } catch (error) {
      failed += 1;
      log("broadcast", `   ✗ ${chatId}${tag} FAILED: ${error.message}`);
    }
  }

  for (const { id, why } of skipped) {
    log("broadcast", `   – ${id}${isTester(id) ? " [tester]" : ""} skipped: ${why}`);
  }

  log(
    "broadcast",
    `── ${mode}: ${sent} sent, ${failed} failed, ${prompted} newly prompted` +
      (isTest ? " (nothing recorded — this was a preview)" : "")
  );
  return { sent, failed, prompted };
}

/** How many testers are configured, and how many would actually receive. */
export function testerCounts() {
  const configured = config.betaTesters.length;
  const subscribed = getBroadcastChatIds().filter((id) =>
    config.betaTesters.includes(String(id))
  ).length;
  return { configured, subscribed };
}

/** Who this would reach, spelled out before the admin commits to sending it. */
export function describeAudience() {
  const { subscribed, unprompted, optedOut } = getBroadcastStats();

  const parts = [`Would go to ${subscribed} ${subscribed === 1 ? "person" : "people"}.`];
  if (unprompted > 0) {
    parts.push(`${unprompted} ${unprompted === 1 ? "hasn't" : "haven't"} been asked yet and would get the opt-in buttons.`);
  }
  if (optedOut > 0) {
    parts.push(`${optedOut} opted out.`);
  }

  const summary = parts.join(" ");

  const testers = testerCounts();
  if (testers.configured === 0) return summary;

  const skipped = testers.configured - testers.subscribed;
  const testerLine =
    `Beta testers: ${testers.subscribed} of ${testers.configured} would receive it` +
    (skipped > 0 ? ` (${skipped} opted out).` : ".");
  return `${summary}\n\n${testerLine}`;
}

/** The preview + buttons shared by /blast and /release. */
export function broadcastPreview(text, pendingId, { draft = false } = {}) {
  const rows = [];
  // Draft notes describe a version nobody is running yet, so there's simply no
  // button that sends them to the community.
  if (!draft) {
    rows.push([Markup.button.callback("Send to everyone", `blast_confirm:${pendingId}`)]);
  }
  if (config.betaTesters.length > 0) {
    rows.push([Markup.button.callback("Send to beta testers", `blast_testers:${pendingId}`)]);
  }
  rows.push([Markup.button.callback("Send to me only", `blast_test:${pendingId}`)]);
  rows.push([Markup.button.callback("Cancel", `blast_cancel:${pendingId}`)]);

  const heading = draft
    ? "Preview (draft notes — this version isn't cut yet, so it can only go to you or the testers):"
    : "Preview:";

  return {
    text: `${heading}\n\n${text}\n\n${describeAudience()}`,
    keyboard: Markup.inlineKeyboard(rows),
  };
}
