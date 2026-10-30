import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { readJson, requireUserId, unauthorized } from "@/lib/api";
import { FIRST_YEAR_SUBJECTS } from "@/lib/subjects";

const assignmentInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  course: z.string().trim().min(1).max(120).optional(),
  courseCode: z.string().trim().min(1).max(120).optional(),
  dueDate: z.string().trim().min(1),
  moodleUrl: z.union([z.string().trim().url(), z.literal(""), z.null()]).optional(),
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

export async function GET() {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const assignments = await prisma.assignment.findMany({
      where: {
        OR: FIRST_YEAR_SUBJECTS.flatMap(({ code }) => [
          { course: code },
          { course: { startsWith: `${code} -` } },
        ]),
      },
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

    return NextResponse.json({
      assignments: assignments.map((assignment) => ({
        ...assignment,
        canDelete: assignment.createdById === userId,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await readJson(request);
    const parsed = assignmentInputSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join(", ");
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const courseValue = parsed.data.courseCode?.trim() || parsed.data.course;
    const subject = FIRST_YEAR_SUBJECTS.find(
      ({ code, title: subjectTitle }) =>
        courseValue === code ||
        courseValue === `${code} - ${subjectTitle}`,
    );
    if (!subject) {
      return NextResponse.json(
        { error: "Choose one of the six First Year CS courses." },
        { status: 400 },
      );
    }

    const dueDate = new Date(parsed.data.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      return NextResponse.json(
        { error: "Enter a valid assignment due date." },
        { status: 400 },
      );
    }

    const assignment = await prisma.assignment.create({
      data: {
        title: parsed.data.title,
        course: `${subject.code} - ${subject.title}`,
        dueDate,
        moodleUrl: parsed.data.moodleUrl || null,
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

    return NextResponse.json(
      { assignment: { ...assignment, canDelete: true } },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Assignment id is required." },
        { status: 400 },
      );
    }

    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found." },
        { status: 404 },
      );
    }
    if (assignment.createdById !== userId) {
      return NextResponse.json(
        { error: "You cannot delete this assignment." },
        { status: 403 },
      );
    }

    await prisma.assignment.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
