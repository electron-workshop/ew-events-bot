import { google } from "googleapis";
import { config } from "../config.js";

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

function buildEventResource(fields) {
  const { title, description, date, time, location, register_link } = fields;

  const descriptionParts = [];
  if (description) descriptionParts.push(description);
  if (register_link) descriptionParts.push(`Register: ${register_link}`);

  const resource = {
    summary: title,
    description: descriptionParts.join("\n\n") || undefined,
    location: location || undefined,
  };

  if (time) {
    const startDateTime = `${date}T${time}:00`;
    resource.start = { dateTime: startDateTime, timeZone: config.timezone };
    // Default to a 2-hour event when no end time is known.
    const [hours, minutes] = time.split(":").map(Number);
    const end = new Date(0);
    end.setUTCHours(hours + 2, minutes);
    const endTime = `${String(end.getUTCHours()).padStart(2, "0")}:${String(
      end.getUTCMinutes()
    ).padStart(2, "0")}`;
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
export async function createCalendarEvent(fields) {
  const calendar = await getCalendarClient();
  const resource = buildEventResource(fields);

  const { data } = await calendar.events.insert({
    calendarId: config.googleCalendarId,
    requestBody: resource,
  });

  return data;
}
