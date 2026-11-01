export type ScheduleAccent = "indigo" | "emerald" | "blue" | "amber";

export type ScheduleCourse = {
  id: string;
  title: string;
  code: string;
  day: string;
  startTime: string;
  endTime: string;
  accent: ScheduleAccent;
  room?: string | null;
  instructor?: string | null;
  term?: string | null;
};

/** Legacy browser key, read once to migrate a local schedule into the account. */
export const SCHEDULE_STORAGE_KEY = "schedule-courses-v1";
export const SCHEDULE_MIGRATED_KEY = "schedule-migrated-v1";

export const SCHEDULE_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const SCHEDULE_ACCENTS: ScheduleAccent[] = [
  "indigo",
  "emerald",
  "blue",
  "amber",
];
