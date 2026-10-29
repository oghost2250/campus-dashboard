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
import { projectUpdateSchema } from "@/lib/validations/project";
import { projectDTO } from "@/lib/serialize";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const body = await readJson(request);
  const parsed = projectUpdateSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const { completedAt, ...rest } = parsed.data;
  const data = {
    ...rest,
    ...(completedAt !== undefined ? { completedAt: parseDate(completedAt) } : {}),
  };

  const result = await prisma.project.updateMany({
    where: { id, userId },
    data,
  });

  if (result.count === 0) return notFound();

  const project = await prisma.project.findFirst({ where: { id, userId } });
  return NextResponse.json({ project: project ? projectDTO(project) : null });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const result = await prisma.project.deleteMany({ where: { id, userId } });

  if (result.count === 0) return notFound();
  return NextResponse.json({ ok: true });
}
