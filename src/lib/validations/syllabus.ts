import { z } from "zod";

export const syllabusTopicInputSchema = z.object({
  course: z
    .string()
    .trim()
    .min(1, "Course is required")
    .max(80, "Course name is too long"),
  title: z
    .string()
    .trim()
    .min(1, "Topic is required")
    .max(200, "Topic is too long"),
  isDone: z.boolean().optional(),
});

export const syllabusTopicUpdateSchema = syllabusTopicInputSchema.partial();

export type SyllabusTopicInput = z.infer<typeof syllabusTopicInputSchema>;
