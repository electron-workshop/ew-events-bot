import { getDueReminders, markNotified, pruneStaleReminders } from "../store/reminders.js";
import { log } from "../logger.js";

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes — reminders are day/week granularity, no need to poll faster

async function checkReminders(bot) {
  const due = getDueReminders();
  if (due.length > 0) {
    log("reminders", `${due.length} reminder(s) due`);
  }

  for (const reminder of due) {
    const leadLabel = reminder.leadTime === "1d" ? "1 day" : "1 week";
    try {
      await bot.telegram.sendMessage(
        reminder.chatId,
        `🔔 Reminder: "${reminder.eventSummary}" is coming up in ${leadLabel}.\n${reminder.eventHtmlLink}`
      );
      markNotified(reminder.id);
      log("reminders", `sent reminder ${reminder.id} to chat ${reminder.chatId}`);
    } catch (error) {
      log("reminders", `failed to send reminder ${reminder.id}: ${error.message}`);
    }
  }

  pruneStaleReminders();
}

export function startReminderScheduler(bot) {
  checkReminders(bot).catch((error) => log("reminders", `check failed: ${error.message}`));
  setInterval(() => {
    checkReminders(bot).catch((error) => log("reminders", `check failed: ${error.message}`));
  }, CHECK_INTERVAL_MS);
  log("reminders", `scheduler started, checking every ${CHECK_INTERVAL_MS / 60000} minutes`);
}
