import { Markup } from "telegraf";
import {
  getBroadcastChatIds,
  getBroadcastStats,
  needsBroadcastPrompt,
  markBroadcastPrompted,
} from "../store/knownChats.js";
import { log } from "../logger.js";

// Goes on every broadcast, so someone who ignored the buttons long ago still
// has a visible way out without having to remember a command exists.
const FOOTER = "\n\n—\nDon't want these? Send /settings";

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
export async function sendBroadcast(telegram, text, { onlyChatId = null } = {}) {
  const isTest = onlyChatId !== null;
  const chatIds = isTest ? [Number(onlyChatId)] : getBroadcastChatIds();

  let sent = 0;
  let failed = 0;
  let prompted = 0;

  for (const chatId of chatIds) {
    const withPrompt = isTest || needsBroadcastPrompt(chatId);
    try {
      await telegram.sendMessage(chatId, text + FOOTER, withPrompt ? PROMPT_KEYBOARD : undefined);
      sent += 1;
      // Only after it actually arrived — otherwise someone who has blocked the
      // bot would be marked as asked without ever having seen the question.
      if (withPrompt && !isTest) {
        markBroadcastPrompted(chatId);
        prompted += 1;
      }
    } catch (error) {
      failed += 1;
      log("broadcast", `failed to send to ${chatId}: ${error.message}`);
    }
  }

  log(
    "broadcast",
    `${isTest ? "test " : ""}sent to ${sent}/${chatIds.length} chats (${failed} failed, ${prompted} prompted)`
  );
  return { sent, failed, prompted };
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
  return parts.join(" ");
}

/** The preview + buttons shared by /blast and /release. */
export function broadcastPreview(text, pendingId) {
  return {
    text: `Preview:\n\n${text}\n\n${describeAudience()}`,
    keyboard: Markup.inlineKeyboard([
      [Markup.button.callback("Send to everyone", `blast_confirm:${pendingId}`)],
      [Markup.button.callback("Send to me only", `blast_test:${pendingId}`)],
      [Markup.button.callback("Cancel", `blast_cancel:${pendingId}`)],
    ]),
  };
}
