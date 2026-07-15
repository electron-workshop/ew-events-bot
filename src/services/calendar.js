import { google } from "googleapis";
import { config } from "../config.js";
import { log } from "../logger.js";
import { computeEndTime } from "./eventTime.js";

let calendarClient = null;

async function getCalendarClient() {
  if (calendarClient) return calendarClient;

  const auth = new google.auth.GoogleAuth({
    keyFile: config.googleServiceAccountKeyPath,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });

  calendarClient = google.calendar({ version: "v3", auth });
  return calendarClient;
}

function buildEventResource(fields, sourceUrl) {
  const { title, description, date, time, location, register_link } = fields;

  const descriptionParts = [];
  if (description) descriptionParts.push(description);
  if (register_link) descriptionParts.push(`Register: ${register_link}`);
  if (sourceUrl && sourceUrl !== register_link) descriptionParts.push(`Original link: ${sourceUrl}`);

  const resource = {
    summary: title,
    description: descriptionParts.join("\n\n") || undefined,
    location: location || undefined,
  };

  if (time) {
    resource.start = { dateTime: `${date}T${time}:00`, timeZone: config.timezone };
    // Default to a 2-hour event when no end time is known.
    const endTime = computeEndTime(time);
    resource.end = { dateTime: `${date}T${endTime}:00`, timeZone: config.timezone };
  } else {
    // All-day event when no time was found.
    resource.start = { date };
    resource.end = { date };
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
