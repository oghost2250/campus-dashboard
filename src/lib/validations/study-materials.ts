import { z } from "zod";

export const studyMaterialCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  course: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
  privacy: z.enum(["private", "public"]).default("private"),
  fileData: z.string().min(1),
  fileType: z.string().trim().min(1).max(120),
});

export type StudyMaterialCreateInput = z.infer<typeof studyMaterialCreateSchema>;
