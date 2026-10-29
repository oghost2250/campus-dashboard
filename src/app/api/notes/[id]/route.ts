import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  notFound,
  readJson,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { noteUpdateSchema } from "@/lib/validations/note";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const body = await readJson(request);
  const parsed = noteUpdateSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const result = await prisma.note.updateMany({
    where: { id, userId },
    data: parsed.data,
  });

  if (result.count === 0) return notFound();

  const note = await prisma.note.findFirst({ where: { id, userId } });
  return NextResponse.json({ note });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const result = await prisma.note.deleteMany({ where: { id, userId } });

  if (result.count === 0) return notFound();
  return NextResponse.json({ ok: true });
}
