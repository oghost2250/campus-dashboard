import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))
  .refine(
    (value) => value === null || /^https?:\/\//i.test(value),
    "Use a link that starts with http:// or https://",
  );

export const projectInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(150, "Title is too long"),
  description: z
    .string()
    .trim()
    .max(5_000, "Description is too long")
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  techStack: z
    .array(z.string().trim().min(1).max(30))
    .max(12, "Use at most 12 technologies")
    .default([]),
  repoUrl: optionalUrl,
  liveUrl: optionalUrl,
  status: z.enum(["IN_PROGRESS", "COMPLETED", "ARCHIVED"]).default("COMPLETED"),
  completedAt: z.string().optional().nullable(),
  featured: z.boolean().optional(),
});

export const projectUpdateSchema = projectInputSchema.partial();

export type ProjectInput = z.infer<typeof projectInputSchema>;
