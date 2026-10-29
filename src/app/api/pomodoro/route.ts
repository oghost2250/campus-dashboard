import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  parseDate,
  readJson,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { pomodoroInputSchema } from "@/lib/validations/productivity";
import { startOfToday } from "@/lib/format";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const body = await readJson(request);
  const parsed = pomodoroInputSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const { startedAt, endedAt, ...rest } = parsed.data;

  const session = await prisma.pomodoroSession.create({
    data: {
      ...rest,
      startedAt: parseDate(startedAt) ?? new Date(),
      endedAt: parseDate(endedAt) ?? new Date(),
      userId,
    },
  });

  return NextResponse.json({ session }, { status: 201 });
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const since = startOfToday();

  const [today, recent] = await Promise.all([
    prisma.pomodoroSession.aggregate({
      where: { userId, wasCompleted: true, startedAt: { gte: since } },
      _sum: { durationMinutes: true },
      _count: true,
    }),
    prisma.pomodoroSession.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    todayMinutes: today._sum.durationMinutes ?? 0,
    todaySessions: today._count,
    recent,
  });
}
