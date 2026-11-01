export type ClockFormat = "12h" | "24h";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isClockTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** Accepts "9:00", "09:00", "9am", "9:30 PM", "21:00" and returns "HH:MM". */
export function parseTimeInput(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  const match = value.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const period = match[3];

  if (period) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (period === "pm" ? 12 : 0);
  }

  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

export function formatClock(
  time: string,
  format: ClockFormat = "12h",
  locale: "en" | "ar" = "en",
): string {
  const [rawHour, rawMinute] = time.split(":").map(Number);
  const hour = Number.isFinite(rawHour) ? rawHour : 0;
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0;

  if (format === "24h") {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(2000, 0, 1, hour, minute));
}

export function formatClockRange(
  start: string,
  end: string,
  format: ClockFormat = "12h",
  locale: "en" | "ar" = "en",
): string {
  return `${formatClock(start, format, locale)} – ${formatClock(end, format, locale)}`;
}

/** Every hour of the day as a 24-hour "HH:00" value for time pickers. */
export const CLOCK_OPTIONS = Array.from({ length: 24 }, (_, hour) =>
  `${String(hour).padStart(2, "0")}:00`,
);
