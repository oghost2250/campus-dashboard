import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  notFound,
  readJson,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { courseUpdateSchema } from "@/lib/validations/course";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const body = await readJson(request);
  const parsed = courseUpdateSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const result = await prisma.course.updateMany({
    where: { id, userId },
    data: parsed.data,
  });

  if (result.count === 0) return notFound();

  const course = await prisma.course.findFirst({
    where: { id, userId },
    include: { assessments: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({ course });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const result = await prisma.course.deleteMany({ where: { id, userId } });

  if (result.count === 0) return notFound();
  return NextResponse.json({ ok: true });
}
