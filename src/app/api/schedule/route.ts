import { NextResponse } from "next/server";
import type { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  readJson,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import {
  scheduleCourseInputSchema,
  scheduleReplaceSchema,
} from "@/lib/validations/schedule";

type ScheduleInput = z.infer<typeof scheduleCourseInputSchema>;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toData(userId: string, input: ScheduleInput) {
  return {
    userId,
    title: input.title,
    code: input.code,
    day: input.day,
    startTime: input.startTime,
    endTime: input.endTime,
    accent: input.accent,
    room: clean(input.room),
    instructor: clean(input.instructor),
    term: clean(input.term),
  };
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const courses = await prisma.scheduleCourse.findMany({
    where: { userId },
    orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ courses });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const parsed = scheduleCourseInputSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  const course = await prisma.scheduleCourse.create({
    data: toData(userId, parsed.data),
  });

  return NextResponse.json({ course }, { status: 201 });
}

/** Replace the whole schedule — used by import and by the one-time migration. */
export async function PUT(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const parsed = scheduleReplaceSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  const courses = await prisma.$transaction(async (tx) => {
    await tx.scheduleCourse.deleteMany({ where: { userId } });
    if (parsed.data.length > 0) {
      await tx.scheduleCourse.createMany({
        data: parsed.data.map((input) => toData(userId, input)),
      });
    }
    return tx.scheduleCourse.findMany({
      where: { userId },
      orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
    });
  });

  return NextResponse.json({ courses });
}

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  await prisma.scheduleCourse.deleteMany({ where: { userId } });
  return NextResponse.json({ ok: true });
}
