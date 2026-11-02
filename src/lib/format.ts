import type { Locale } from "@/i18n/config";

const localeTag = (locale: Locale) => (locale === "ar" ? "ar" : "en");

export function formatDate(
  value: Date | string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
  timeZone?: string,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const resolved = timeZone ? { ...options, timeZone } : options;
  return new Intl.DateTimeFormat(localeTag(locale), resolved).format(date);
}

/** Calendar day as `YYYY-MM-DD` in `timeZone` (defaults to the runtime zone). */
function dayKey(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function formatDateTime(value: Date | string, locale: Locale): string {
  return formatDate(value, locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(value: Date | string, locale: Locale): string {
  return formatDate(value, locale, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Whole calendar days from "today". Negative = overdue.
 *
 * Pass `timeZone` and `now` when the value must match between the server and
 * the browser; without them each side uses its own clock and zone.
 */
export function daysUntil(
  value: Date | string,
  options: { timeZone?: string; now?: Date } = {},
): number {
  const date = typeof value === "string" ? new Date(value) : value;
  const now = options.now ?? new Date();
  const target = Date.parse(`${dayKey(date, options.timeZone)}T00:00:00Z`);
  const today = Date.parse(`${dayKey(now, options.timeZone)}T00:00:00Z`);
  return Math.round((target - today) / 86_400_000);
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function endOfWeek(): Date {
  const start = startOfToday();
  return new Date(start.getTime() + 7 * 86_400_000);
}

/** Value for <input type="date">. */
export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
