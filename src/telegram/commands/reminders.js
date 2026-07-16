import { Markup } from "telegraf";
import { getRemindersForChat, LEAD_LABELS } from "../../store/reminders.js";
import { log } from "../../logger.js";

export async function handleReminders(ctx) {
  log("reminders", `/reminders requested by ${ctx.from.id} in chat ${ctx.chat.id}`);

  const reminders = getRemindersForChat(ctx.chat.id);
  if (reminders.length === 0) {
    await ctx.reply("No reminders.");
    return;
  }

  const lines = reminders.map(
    (r, i) => `${i + 1}. "${r.eventSummary}" — ${LEAD_LABELS[r.leadTime]} before`
  );
  const buttons = reminders.map((r, i) => Markup.button.callback(`❌ ${i + 1}`, `reminder_cancel:${r.id}`));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(buttons.slice(i, i + 5));
  }

  await ctx.reply(
    `Your reminders:\n\n${lines.join("\n")}\n\nTap ❌ to cancel one.`,
    Markup.inlineKeyboard(rows)
  );
}
