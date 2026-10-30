import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  isAdminUser,
  readJson,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { FIRST_YEAR_SUBJECTS } from "@/lib/subjects";

/** Every shared card belongs to this cohort. */
const COHORT = "CS-1";

const MAX_PAGE_SIZE = 200;
const MAX_CREATES_PER_DAY = 50;
const MAX_CREATES_PER_WINDOW = 10;
const CREATE_WINDOW_MS = 10 * 60 * 1000;

const assignmentInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  course: z.string().trim().min(1).max(120).optional(),
  courseCode: z.string().trim().min(1).max(120).optional(),
  dueDate: z.string().trim().min(1),
  moodleUrl: z.union([z.string().trim().url(), z.literal(""), z.null()]).optional(),
});

const assignmentSelect = {
  id: true,
  title: true,
  course: true,
  dueDate: true,
  moodleUrl: true,
  createdById: true,
  createdBy: { select: { name: true, email: true } },
  createdAt: true,
} as const;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

/**
 * GET /api/assignments?page=1&pageSize=100
 *
 * Returns the shared First Year CS batch feed. Every student sees the same
 * rows, so the response is safe to cache briefly per user (the only
 * user-specific field is `canDelete`).
 */
export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const params = new URL(request.url).searchParams;
    const rawPage = Number(params.get("page"));
    const rawPageSize = Number(params.get("pageSize"));
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.trunc(rawPage) : 1;
    const pageSize =
      Number.isFinite(rawPageSize) && rawPageSize > 0
        ? Math.min(Math.trunc(rawPageSize), MAX_PAGE_SIZE)
        : 100;

    const where = { cohort: COHORT, isActive: true };

    const [assignments, total] = await Promise.all([
      prisma.assignment.findMany({
        where,
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: assignmentSelect,
      }),
      prisma.assignment.count({ where }),
    ]);

    return NextResponse.json(
      {
        assignments: assignments.map((assignment) => ({
          ...assignment,
          canDelete: assignment.createdById === userId,
        })),
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
      },
      {
        headers: {
          // Per-user payload (canDelete) but identical for ~15s is fine.
          "Cache-Control": "private, max-age=15, stale-while-revalidate=45",
        },
      },
    );
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

/** POST /api/assignments — create a batch-wide card for the CS-1 cohort. */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const burst = rateLimit(
      `assignments:create:${userId}`,
      MAX_CREATES_PER_WINDOW,
      CREATE_WINDOW_MS,
    );
    if (!burst.ok) return tooManyRequests(burst.retryAfter);

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

    // Database-backed cap: survives across serverless instances, unlike the
    // in-memory limiter.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const createdToday = await prisma.assignment.count({
      where: { createdById: userId, createdAt: { gte: since } },
    });
    if (createdToday >= MAX_CREATES_PER_DAY) {
      return tooManyRequests(
        60 * 60,
        "Daily assignment creation limit reached. Try again tomorrow.",
      );
    }

    const assignment = await prisma.assignment.create({
      data: {
        title: parsed.data.title,
        course: `${subject.code} - ${subject.title}`,
        dueDate,
        moodleUrl: parsed.data.moodleUrl || null,
        createdById: userId,
        cohort: COHORT,
      },
      select: assignmentSelect,
    });

    return NextResponse.json(
      { assignment: { ...assignment, canDelete: true } },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

/** DELETE /api/assignments?id=… — creator or an admin can remove a card. */
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

    const allowed =
      assignment.createdById === userId || (await isAdminUser(userId));
    if (!allowed) {
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
