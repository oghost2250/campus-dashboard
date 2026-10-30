import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  forbidden,
  invalid,
  notFound,
  readJson,
  requireUserId,
  unauthorized,
} from "@/lib/api";

const privacySchema = z.object({ privacy: z.enum(["private", "public"]) });

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const row = await prisma.studyMaterial.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!row) return notFound();
  if (row.userId !== userId) return forbidden();

  const parsed = privacySchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  const updated = await prisma.studyMaterial.update({
    where: { id },
    data: { privacy: parsed.data.privacy },
  });

  return NextResponse.json({ ok: true, privacy: updated.privacy });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const row = await prisma.studyMaterial.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!row) return notFound();

  const isAdmin = await (async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    return Boolean(user && user.status === "ACTIVE" && user.role !== "USER");
  })();

  if (row.userId !== userId && !isAdmin) return forbidden();

  await prisma.studyMaterial.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
