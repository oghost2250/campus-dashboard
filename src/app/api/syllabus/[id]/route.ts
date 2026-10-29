import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  notFound,
  readJson,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { syllabusTopicUpdateSchema } from "@/lib/validations/syllabus";
import { syllabusTopicDTO } from "@/lib/serialize";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const body = await readJson(request);
  const parsed = syllabusTopicUpdateSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const result = await prisma.syllabusTopic.updateMany({
    where: { id, userId },
    data: parsed.data,
  });

  if (result.count === 0) return notFound();

  const topic = await prisma.syllabusTopic.findFirst({
    where: { id, userId },
  });

  return NextResponse.json({ topic: topic ? syllabusTopicDTO(topic) : null });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const result = await prisma.syllabusTopic.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) return notFound();
  return NextResponse.json({ ok: true });
}
