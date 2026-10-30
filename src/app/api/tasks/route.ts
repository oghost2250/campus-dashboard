import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  parseDate,
  readJson,
  readPagination,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { taskInputSchema } from "@/lib/validations/task";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { limit, offset } = readPagination(request);

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where: { userId },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.task.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    tasks,
    total,
    hasMore: offset + tasks.length < total,
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const body = await readJson(request);
  const parsed = taskInputSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const { dueDate, description, ...rest } = parsed.data;

  const task = await prisma.task.create({
    data: {
      ...rest,
      description: description ?? null,
      dueDate: parseDate(dueDate),
      completedAt: rest.status === "DONE" ? new Date() : null,
      userId,
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}
