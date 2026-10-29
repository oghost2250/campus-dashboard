import { z } from "zod";

export const assessmentTypes = [
  "QUIZ",
  "ASSIGNMENT",
  "LAB",
  "MIDTERM",
  "FINAL",
  "PROJECT",
  "OTHER",
] as const;

export type AssessmentType = (typeof assessmentTypes)[number];

export const courseInputSchema = z.object({
  name: z.string().trim().min(1, "Course name is required").max(120),
  code: z
    .string()
    .trim()
    .max(20)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value)),
  credits: z.coerce.number().int().min(0).max(30).default(3),
  targetGrade: z
    .string()
    .trim()
    .max(4)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value)),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour")
    .default("#6366f1"),
});

export const courseUpdateSchema = courseInputSchema.partial();

export const assessmentInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  type: z.enum(assessmentTypes).default("OTHER"),
  weight: z.coerce.number().min(0, "Minimum 0").max(100, "Maximum 100"),
  score: z.coerce.number().min(0).max(10_000).nullable().optional(),
  maxScore: z.coerce.number().min(0).max(10_000).nullable().optional(),
  dueDate: z.string().trim().nullable().optional(),
});

export const assessmentUpdateSchema = assessmentInputSchema.partial();

export type CourseInput = z.infer<typeof courseInputSchema>;
export type AssessmentInput = z.infer<typeof assessmentInputSchema>;
