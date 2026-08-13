import { Markup } from "telegraf";
import {
  getBroadcastChatIds,
  needsBroadcastPrompt,
  markBroadcastPrompted,
} from "../store/knownChats.js";
import { config } from "../config.js";
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
 * Sends `text` to everyone still subscribed. The first broadcast a person ever
 * receives carries the opt-out buttons; after that it's the footer alone.
 * Returns { sent, failed, prompted }.
 */
export async function sendBroadcast(telegram, text) {
  const chatIds = getBroadcastChatIds().filter(
    (id) => String(id) !== String(config.adminChatId)
  );

  let sent = 0;
  let failed = 0;
  let prompted = 0;

  for (const chatId of chatIds) {
    const withPrompt = needsBroadcastPrompt(chatId);
    try {
      await telegram.sendMessage(chatId, text + FOOTER, withPrompt ? PROMPT_KEYBOARD : undefined);
      sent += 1;
      // Only after it actually arrived — otherwise someone who has blocked the
      // bot would be marked as asked without ever having seen the question.
      if (withPrompt) {
        markBroadcastPrompted(chatId);
        prompted += 1;
      }
    } catch (error) {
      failed += 1;
      log("broadcast", `failed to send to ${chatId}: ${error.message}`);
    }
  }

  log("broadcast", `sent to ${sent}/${chatIds.length} chats (${failed} failed, ${prompted} prompted)`);
  return { sent, failed, prompted };
}
