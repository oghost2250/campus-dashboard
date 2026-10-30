import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { readJson, requireUserId, unauthorized } from "@/lib/api";
import { z } from "zod";

const assignmentInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  course: z.string().trim().min(1).max(120),
  dueDate: z.string().datetime(),
  moodleUrl: z.string().trim().url().optional().or(z.literal("")),
});

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const assignments = await prisma.assignment.findMany({
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      title: true,
      course: true,
      dueDate: true,
      moodleUrl: true,
      createdById: true,
      createdBy: { select: { name: true, email: true } },
      createdAt: true,
    },
  });

  return NextResponse.json({ assignments });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const body = await readJson(request);
  const parsed = assignmentInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 422 });
  }

  const { title, course, dueDate, moodleUrl } = parsed.data;

  const assignment = await prisma.assignment.create({
    data: {
      title,
      course,
      dueDate: new Date(dueDate),
      moodleUrl: moodleUrl || null,
      createdById: userId,
    },
    select: {
      id: true,
      title: true,
      course: true,
      dueDate: true,
      moodleUrl: true,
      createdById: true,
      createdBy: { select: { name: true, email: true } },
      createdAt: true,
    },
  });

  return NextResponse.json({ assignment }, { status: 201 });
}

export async function DELETE(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (!assignment) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (assignment.createdById !== userId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  await prisma.assignment.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
