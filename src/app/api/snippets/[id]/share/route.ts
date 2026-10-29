import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { notFound, requireUserId, unauthorized } from "@/lib/api";
import { snippetDTO } from "@/lib/serialize";

type RouteContext = { params: Promise<{ id: string }> };

/** Turn on (or refresh) the public link for one of the caller's snippets. */
export async function POST(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const existing = await prisma.snippet.findFirst({
    where: { id, userId },
    select: { id: true, shareSlug: true },
  });

  if (!existing) return notFound();

  const snippet = await prisma.snippet.update({
    where: { id: existing.id },
    data: {
      isPublic: true,
      // Re-use the previous slug so an already-shared link keeps working.
      shareSlug: existing.shareSlug ?? randomBytes(9).toString("base64url"),
    },
  });

  return NextResponse.json({ snippet: snippetDTO(snippet) });
}

/** Take the public link offline without deleting the snippet. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const result = await prisma.snippet.updateMany({
    where: { id, userId },
    data: { isPublic: false },
  });

  if (result.count === 0) return notFound();

  const snippet = await prisma.snippet.findFirst({ where: { id, userId } });
  return NextResponse.json({
    snippet: snippet ? snippetDTO(snippet) : null,
  });
}
