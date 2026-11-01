import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  notFound,
  readJson,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { scheduleCourseUpdateSchema } from "@/lib/validations/schedule";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const parsed = scheduleCourseUpdateSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  const { room, instructor, term, ...rest } = parsed.data;

  const result = await prisma.scheduleCourse.updateMany({
    where: { id, userId },
    data: {
      ...rest,
      ...(room !== undefined ? { room: room?.trim() || null } : {}),
      ...(instructor !== undefined
        ? { instructor: instructor?.trim() || null }
        : {}),
      ...(term !== undefined ? { term: term?.trim() || null } : {}),
    },
  });

  if (result.count === 0) return notFound();

  const course = await prisma.scheduleCourse.findFirst({ where: { id, userId } });
  return NextResponse.json({ course });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const result = await prisma.scheduleCourse.deleteMany({ where: { id, userId } });
  if (result.count === 0) return notFound();

  return NextResponse.json({ ok: true });
}
