const DEFAULT_DURATION_HOURS = 2;

/**
 * Given a "HH:MM" start time, returns the default end time (start + 2h) in
 * the same format. Returns null if there's no start time. Shared between
 * the calendar write and the Telegram preview so they never disagree.
 */
export function computeEndTime(time, durationHours = DEFAULT_DURATION_HOURS) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  const end = new Date(0);
  end.setUTCHours(hours + durationHours, minutes);
  return `${String(end.getUTCHours()).padStart(2, "0")}:${String(end.getUTCMinutes()).padStart(2, "0")}`;
}
