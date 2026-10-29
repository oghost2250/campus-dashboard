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
import { taskUpdateSchema } from "@/lib/validations/task";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const body = await readJson(request);
  const parsed = taskUpdateSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const { dueDate, ...rest } = parsed.data;

  const result = await prisma.task.updateMany({
    where: { id, userId },
    data: {
      ...rest,
      ...(dueDate !== undefined ? { dueDate: parseDate(dueDate) } : {}),
      ...(rest.status
        ? { completedAt: rest.status === "DONE" ? new Date() : null }
        : {}),
    },
  });

  if (result.count === 0) return notFound();

  const task = await prisma.task.findFirst({ where: { id, userId } });
  return NextResponse.json({ task });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const result = await prisma.task.deleteMany({ where: { id, userId } });

  if (result.count === 0) return notFound();
  return NextResponse.json({ ok: true });
}
