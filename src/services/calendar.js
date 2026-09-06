import { google } from "googleapis";
import { config } from "../config.js";
import { log } from "../logger.js";
import { resolveEndTime, endsNextDay, addDays, dayCount, isDateKey } from "./eventTime.js";

let calendarClient = null;

async function getCalendarClient() {
  if (calendarClient) return calendarClient;

  const auth = new google.auth.GoogleAuth({
    // Credentials inline when the platform gives secrets as env vars, a key
    // file when they're on disk. config.js guarantees exactly one is set.
    ...(config.googleServiceAccountCredentials
      ? { credentials: config.googleServiceAccountCredentials }
      : { keyFile: config.googleServiceAccountKeyPath }),
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });

  calendarClient = google.calendar({ version: "v3", auth });
  return calendarClient;
}

function buildEventResource(fields, sourceUrl) {
  const { title, description, date, end_date, time, end_time, location, register_link } = fields;

  const descriptionParts = [];
  if (description) descriptionParts.push(description);
  if (register_link) descriptionParts.push(`Register: ${register_link}`);
  if (sourceUrl && sourceUrl !== register_link) descriptionParts.push(`Original link: ${sourceUrl}`);

  const resource = {
    summary: title,
    description: descriptionParts.join("\n\n") || undefined,
    location: location || undefined,
  };

  const days = end_date ? dayCount(date, end_date) : 1;

  if (time) {
    resource.start = { dateTime: `${date}T${time}:00`, timeZone: config.timezone };

    // The page's own end time where there is one, otherwise 2 hours.
    const endTime = resolveEndTime(time, end_time);
    // Something running 20:00–01:00 finishes on the following day.
    const lastDay = endsNextDay(time, endTime) && isDateKey(date) ? addDays(date, 1) : date;
    resource.end = { dateTime: `${lastDay}T${endTime}:00`, timeZone: config.timezone };

    // A conference that runs 9–5 on two days is two 9–5 sittings, not one block
    // running through the night between them. Recurring instead of spanning also
    // means each day is listed and can be reminded on separately, because
    // listUpcomingEvents expands recurrences via singleEvents.
    if (days > 1) {
      resource.recurrence = [`RRULE:FREQ=DAILY;COUNT=${days}`];
    }
  } else {
    // All-day event when no time was found. Google treats end.date as
    // exclusive, so it's the day *after* the last day the event runs — even
    // for a single-day event, where start and end would otherwise be equal
    // and describe a zero-length event.
    resource.start = { date };
    // If the date isn't a real YYYY-MM-DD we can't do the arithmetic, so pass
    // it through and let the API report it rather than throwing here.
    resource.end = { date: isDateKey(date) ? addDays(date, days) : date };
  }

  return resource;
}

/**
 * Creates an event on the configured calendar. Returns the created
 * event's htmlLink so it can be shared back to the requester.
 */
export async function createCalendarEvent(fields, sourceUrl) {
  const calendar = await getCalendarClient();
  const resource = buildEventResource(fields, sourceUrl);
  log("calendar", "inserting event:", resource);

  const { data } = await calendar.events.insert({
    calendarId: config.googleCalendarId,
    requestBody: resource,
  });

  log("calendar", `created event ${data.id}: ${data.htmlLink}`);
  return data;
}

/**
 * Lists events starting between timeMin and timeMax (both Date objects),
 * earliest first.
 */
export async function listUpcomingEvents(timeMin, timeMax) {
  const calendar = await getCalendarClient();
  const { data } = await calendar.events.list({
    calendarId: config.googleCalendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });
  return data.items || [];
}

/** Fetches a single event by its Google Calendar event ID. */
export async function getCalendarEvent(eventId) {
  const calendar = await getCalendarClient();
  const { data } = await calendar.events.get({
    calendarId: config.googleCalendarId,
    eventId,
  });
  return data;
}
