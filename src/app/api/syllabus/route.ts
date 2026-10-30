import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  readJson,
  readPagination,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { syllabusTopicInputSchema } from "@/lib/validations/syllabus";
import { syllabusTopicDTO } from "@/lib/serialize";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { limit, offset } = readPagination(request);

  const [topics, total] = await Promise.all([
    prisma.syllabusTopic.findMany({
      where: { userId },
      orderBy: [{ course: "asc" }, { createdAt: "asc" }],
      take: limit,
      skip: offset,
    }),
    prisma.syllabusTopic.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    topics: topics.map(syllabusTopicDTO),
    total,
    hasMore: offset + topics.length < total,
  });
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
