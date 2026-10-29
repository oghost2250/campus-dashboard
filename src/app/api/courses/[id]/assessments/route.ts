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
import { assessmentInputSchema } from "@/lib/validations/course";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;

  const course = await prisma.course.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!course) return notFound();

  const body = await readJson(request);
  const parsed = assessmentInputSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const { dueDate, ...rest } = parsed.data;

  const assessment = await prisma.assessment.create({
    data: {
      ...rest,
      dueDate: parseDate(dueDate),
      courseId: course.id,
    },
  });

  return NextResponse.json({ assessment }, { status: 201 });
}
