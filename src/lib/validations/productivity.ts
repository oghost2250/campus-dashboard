import { z } from "zod";

export const pomodoroInputSchema = z.object({
  label: z.string().trim().max(120).default("Focus"),
  durationMinutes: z.coerce.number().int().min(1).max(180),
  wasCompleted: z.boolean().default(true),
  startedAt: z.string().optional().nullable(),
  endedAt: z.string().optional().nullable(),
});

export const profileInputSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  locale: z.enum(["en", "ar"]).optional(),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
