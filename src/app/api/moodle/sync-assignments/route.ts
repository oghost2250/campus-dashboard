import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUserId, unauthorized } from "@/lib/api";
import { FIRST_YEAR_SUBJECTS } from "@/lib/subjects";

type MoodleAssignment = {
  id: number | string;
  name: string;
  duedate?: number;
};

type MoodleCourse = {
  fullname?: string;
  shortname?: string;
  assignments?: MoodleAssignment[];
};

async function fetchFromMoodle(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.moodleToken) return null;

  const baseUrl = user.moodleUrl ?? "https://moodle.zewailcity.edu.eg";
  const token = user.moodleToken;

  try {
    const url = new URL(`${baseUrl}/webservice/rest/server.php`);
    url.searchParams.set("wstoken", token);
    url.searchParams.set("wsfunction", "mod_assign_get_assignments");
    url.searchParams.set("moodlewsrestformat", "json");

    const response = await fetch(url.toString());
    const data = await response.json().catch(() => null);
    const courses = (data?.courses ?? []) as MoodleCourse[];

    return courses.flatMap((course) =>
      (course.assignments ?? []).map((assignment) => ({
        id: String(assignment.id),
        title: assignment.name,
        course: course.fullname ?? course.shortname ?? "Course",
        dueDate: assignment.duedate
          ? new Date(assignment.duedate * 1000).toISOString()
          : new Date(Date.now() + 7 * 86400000).toISOString(),
        moodleAssignmentId: String(assignment.id),
      })),
    );
  } catch {
    return null;
  }
}

function fallbackAssignments() {
  return FIRST_YEAR_SUBJECTS.map((subject, index) => ({
    id: `preset-${index + 1}`,
    title: `${subject.code} - Assignment ${index + 1}`,
    course: `${subject.code} - ${subject.title}`,
    dueDate: new Date(
      Date.now() + (index + 1) * 2 * 86400000,
    ).toISOString(),
    moodleAssignmentId: `mdl-${1000 + index}`,
  }));
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const moodleAssignments = await fetchFromMoodle(userId);
  if (moodleAssignments?.length) {
    return NextResponse.json({ assignments: moodleAssignments, source: "moodle" });
  }

  return NextResponse.json({ assignments: fallbackAssignments(), source: "presets" });
}

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const moodleAssignments = await fetchFromMoodle(userId);
  if (moodleAssignments?.length) {
    return NextResponse.json({ assignments: moodleAssignments, source: "moodle" });
  }

  return NextResponse.json({ assignments: fallbackAssignments(), source: "presets" });
}
