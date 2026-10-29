import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  readJson,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { courseInputSchema } from "@/lib/validations/course";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const courses = await prisma.course.findMany({
    where: { userId },
    include: { assessments: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ courses });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const body = await readJson(request);
  const parsed = courseInputSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const course = await prisma.course.create({
    data: { ...parsed.data, userId },
    include: { assessments: true },
  });

  return NextResponse.json({ course }, { status: 201 });
}
