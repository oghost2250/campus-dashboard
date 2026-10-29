import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  readJson,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { syllabusTopicInputSchema } from "@/lib/validations/syllabus";
import { syllabusTopicDTO } from "@/lib/serialize";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const topics = await prisma.syllabusTopic.findMany({
    where: { userId },
    orderBy: [{ course: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ topics: topics.map(syllabusTopicDTO) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const body = await readJson(request);
  const parsed = syllabusTopicInputSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const topic = await prisma.syllabusTopic.create({
    data: {
      course: parsed.data.course,
      title: parsed.data.title,
      isDone: parsed.data.isDone ?? false,
      userId,
    },
  });

  return NextResponse.json(
    { topic: syllabusTopicDTO(topic) },
    { status: 201 },
  );
}
