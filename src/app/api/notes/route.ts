import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  readJson,
  readPagination,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { noteCreateSchema } from "@/lib/validations/note";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { limit, offset } = readPagination(request);

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where: { userId },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.note.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    notes,
    total,
    hasMore: offset + notes.length < total,
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const body = (await readJson(request)) ?? {};
  const parsed = noteCreateSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const note = await prisma.note.create({
    data: {
      title: parsed.data.title?.trim() || "Untitled note",
      content: "",
      userId,
    },
  });

  return NextResponse.json({ note }, { status: 201 });
}
