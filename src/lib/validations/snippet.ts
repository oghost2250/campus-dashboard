import { z } from "zod";

export const snippetInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(150, "Title is too long"),
  code: z.string().min(1, "Code is required").max(50_000, "Snippet is too large"),
  language: z.string().trim().min(1).max(40).default("typescript"),
  tags: z
    .array(z.string().trim().min(1).max(24))
    .max(10, "Use at most 10 tags")
    .default([]),
  isFavorite: z.boolean().optional(),
});

export const snippetUpdateSchema = snippetInputSchema.partial();

export type SnippetInput = z.infer<typeof snippetInputSchema>;
