import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  readJson,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { noteCreateSchema } from "@/lib/validations/note";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const notes = await prisma.note.findMany({
    where: { userId },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ notes });
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
