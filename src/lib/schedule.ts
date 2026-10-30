import { loadPersisted, savePersisted } from "@/lib/browser-store";

export type ScheduleAccent = "indigo" | "emerald" | "blue" | "amber";

export type ScheduleCourse = {
  id: string;
  title: string;
  code: string;
  day: string;
  startTime: string;
  endTime: string;
  accent: ScheduleAccent;
  room?: string;
  instructor?: string;
  term?: string;
};

export const SCHEDULE_STORAGE_KEY = "schedule-courses-v1";

export const SCHEDULE_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export async function loadSchedule(): Promise<ScheduleCourse[]> {
  const stored = await loadPersisted<ScheduleCourse[]>(SCHEDULE_STORAGE_KEY);
  return Array.isArray(stored) ? stored : [];
}

export async function saveSchedule(courses: ScheduleCourse[]): Promise<void> {
  await savePersisted(SCHEDULE_STORAGE_KEY, courses);
}
