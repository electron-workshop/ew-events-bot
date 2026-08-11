import { Markup } from "telegraf";
import { getCalendarEvent } from "../../services/calendar.js";
import { addReminder, removeReminder, LEAD_LABELS } from "../../store/reminders.js";
import { resolveEventRef } from "../../store/eventRefs.js";
import { log } from "../../logger.js";
import { answerCb } from "../answerCb.js";

function eventStartIso(event) {
  return event.start.dateTime || `${event.start.date}T09:00:00`;
}

export function registerReminderHandlers(bot) {
  bot.action(/^remind:(.+)$/, async (ctx) => {
    const ref = ctx.match[1];
    const eventId = resolveEventRef(ref);
    log("reminders", `remind button tapped for ref ${ref} by ${ctx.from.id}`);

    if (!eventId) {
      await answerCb(ctx, "This has expired — run /today, /week, or /month again.");
      return;
    }

    let event;
    try {
      event = await getCalendarEvent(eventId);
    } catch (error) {
      log("reminders", `couldn't fetch event ${eventId}: ${error.message}`);
      await answerCb(ctx, "Couldn't find that event — it may have been removed.");
      return;
    }

    await answerCb(ctx);
    await ctx.reply(
      `When would you like to be reminded about "${event.summary}"?`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("1 hour before", `remind_set:${ref}:1h`),
          Markup.button.callback("1 day before", `remind_set:${ref}:1d`),
          Markup.button.callback("1 week before", `remind_set:${ref}:1w`),
        ],
        [Markup.button.callback("No Reminder", "remind_cancel")],
      ])
    );
  });

  bot.action("remind_cancel", async (ctx) => {
    await answerCb(ctx);
    await ctx.editMessageText("No reminder set.");
  });

  bot.action(/^remind_set:(.+):(1h|1d|1w)$/, async (ctx) => {
    const ref = ctx.match[1];
    const leadTime = ctx.match[2];
    const eventId = resolveEventRef(ref);

    if (!eventId) {
      await answerCb(ctx, "This has expired — run /today, /week, or /month again.");
      return;
    }

    let event;
    try {
      event = await getCalendarEvent(eventId);
    } catch (error) {
      log("reminders", `couldn't fetch event ${eventId}: ${error.message}`);
      await answerCb(ctx, "Couldn't find that event — it may have been removed.");
      return;
    }

    addReminder({
      eventId,
      eventSummary: event.summary,
      eventStart: eventStartIso(event),
      eventHtmlLink: event.htmlLink,
      chatId: ctx.chat.id,
      leadTime,
    });

    const leadLabel = LEAD_LABELS[leadTime];
    await answerCb(ctx, "Reminder set!");
    await ctx.editMessageText(`🔔 Got it — I'll remind you ${leadLabel} before "${event.summary}".`);
  });

  bot.action(/^reminder_cancel:(.+)$/, async (ctx) => {
    const id = ctx.match[1];
    const removed = removeReminder(id);
    log("reminders", `${removed ? "cancelled" : "couldn't find"} reminder ${id} for ${ctx.from.id}`);
    await answerCb(ctx, removed ? "Reminder cancelled." : "Already gone.");
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
  });
}
