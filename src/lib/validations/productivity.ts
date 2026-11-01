import { z } from "zod";

export const pomodoroInputSchema = z.object({
  label: z.string().trim().max(120).default("Focus"),
  durationMinutes: z.coerce.number().int().min(1).max(180),
  wasCompleted: z.boolean().default(true),
  startedAt: z.string().optional().nullable(),
  endedAt: z.string().optional().nullable(),
});

export const profileInputSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(80).optional(),
    locale: z.enum(["en", "ar"]).optional(),
    theme: z.enum(["light", "dark", "system"]).nullish(),
    timeFormat: z.enum(["12h", "24h"]).optional(),
    pomodoroSettings: z
      .object({
        focus: z.coerce.number().int().min(1).max(180),
        short: z.coerce.number().int().min(1).max(180),
        long: z.coerce.number().int().min(1).max(180),
        sound: z.boolean(),
        autoStart: z.boolean(),
      })
      .optional(),
    gpaScale: z.union([z.literal(4), z.literal(5)]).nullable().optional(),
    isDeveloper: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.locale !== undefined ||
      data.theme !== undefined ||
      data.timeFormat !== undefined ||
      data.pomodoroSettings !== undefined ||
      data.gpaScale !== undefined ||
      data.isDeveloper !== undefined,
    { message: "Nothing to update" },
  );

export type ProfileInput = z.infer<typeof profileInputSchema>;
