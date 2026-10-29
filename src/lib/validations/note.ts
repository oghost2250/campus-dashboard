import { z } from "zod";

export const noteInputSchema = z.object({
  title: z.string().trim().max(200).default("Untitled note"),
  content: z.string().max(100_000).default(""),
  isPinned: z.boolean().optional(),
});

export const noteUpdateSchema = noteInputSchema.partial();

export const noteCreateSchema = z.object({
  title: z.string().trim().max(200).optional(),
});

export type NoteInput = z.infer<typeof noteInputSchema>;
