import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  notFound,
  parseDate,
  readJson,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { assessmentUpdateSchema } from "@/lib/validations/course";

type RouteContext = { params: Promise<{ id: string }> };

async function ownedAssessment(id: string, userId: string) {
  return prisma.assessment.findFirst({
    where: { id, course: { userId } },
    select: { id: true },
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!(await ownedAssessment(id, userId))) return notFound();

  const body = await readJson(request);
  const parsed = assessmentUpdateSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const { dueDate, ...rest } = parsed.data;

  const assessment = await prisma.assessment.update({
    where: { id },
    data: {
      ...rest,
      ...(dueDate !== undefined ? { dueDate: parseDate(dueDate) } : {}),
    },
  });

  return NextResponse.json({ assessment });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!(await ownedAssessment(id, userId))) return notFound();

  await prisma.assessment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
