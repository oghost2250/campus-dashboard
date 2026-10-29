import type { Locale } from "@/i18n/config";

const localeTag = (locale: Locale) => (locale === "ar" ? "ar" : "en");

export function formatDate(
  value: Date | string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(localeTag(locale), options).format(date);
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

/** Whole calendar days from today (local time). Negative = overdue. */
export function daysUntil(value: Date | string): number {
  const date = typeof value === "string" ? new Date(value) : value;
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
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
