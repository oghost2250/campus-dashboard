import { z } from "zod";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const scheduleDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const scheduleCourseFields = z.object({
  title: z.string().trim().min(1, "Course title is required").max(120),
  code: z.string().trim().max(40).default(""),
  day: z.enum(scheduleDays),
  startTime: z.string().regex(TIME, "Use HH:MM"),
  endTime: z.string().regex(TIME, "Use HH:MM"),
  accent: z.enum(["indigo", "emerald", "blue", "amber"]).default("indigo"),
  room: z.string().trim().max(80).nullish(),
  instructor: z.string().trim().max(120).nullish(),
  term: z.string().trim().max(40).nullish(),
});

export const scheduleCourseInputSchema = scheduleCourseFields.refine(
  (data) => data.endTime > data.startTime,
  { message: "End time must be after start time", path: ["endTime"] },
);

export const scheduleCourseUpdateSchema = scheduleCourseFields.partial();

export const scheduleReplaceSchema = z
  .array(scheduleCourseInputSchema)
  .max(200, "Too many courses");
