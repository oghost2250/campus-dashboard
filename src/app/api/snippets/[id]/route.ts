import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  notFound,
  readJson,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { snippetUpdateSchema } from "@/lib/validations/snippet";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const body = await readJson(request);
  const parsed = snippetUpdateSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const result = await prisma.snippet.updateMany({
    where: { id, userId },
    data: parsed.data,
  });

  if (result.count === 0) return notFound();

  const snippet = await prisma.snippet.findFirst({ where: { id, userId } });
  return NextResponse.json({ snippet });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const result = await prisma.snippet.deleteMany({ where: { id, userId } });

  if (result.count === 0) return notFound();
  return NextResponse.json({ ok: true });
}
