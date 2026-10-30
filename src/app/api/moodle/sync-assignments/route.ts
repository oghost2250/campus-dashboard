import { NextResponse } from "next/server";

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

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const moodleUrl = process.env.MOODLE_URL;
  const moodleToken = process.env.MOODLE_TOKEN;

  // If Moodle is connected, attempt a live sync. Otherwise fall back to the
  // Subjects First Year presets so the dashboard is never empty.
  if (moodleUrl && moodleToken) {
    try {
      const url = new URL(`${moodleUrl}/webservice/rest/server.php`);
      url.searchParams.set("wstoken", moodleToken);
      url.searchParams.set("wsfunction", "mod_assign_get_assignments");
      url.searchParams.set("moodlewsrestformat", "json");

      const response = await fetch(url.toString());
      const data = await response.json().catch(() => null);
      const courses = (data?.courses ?? []) as MoodleCourse[];

      const assignments = courses.flatMap((course) =>
        (course.assignments ?? []).map((assignment) => ({
          id: String(assignment.id),
          title: assignment.name,
          course: course.fullname ?? course.shortname,
          dueDate: assignment.duedate
            ? new Date(assignment.duedate * 1000).toISOString()
            : new Date(Date.now() + 7 * 86400000).toISOString(),
          moodleAssignmentId: String(assignment.id),
        })),
      );

      if (assignments.length > 0) {
        return NextResponse.json({ assignments, source: "moodle" });
      }
    } catch (error) {
      console.error("Moodle sync failed:", error);
    }
  }

  // Fallback: Subjects First Year presets with staggered due dates.
  const assignments = FIRST_YEAR_SUBJECTS.map((subject, index) => ({
    id: `preset-${index + 1}`,
    title: `${subject.code} - Assignment ${index + 1}`,
    course: `${subject.code} - ${subject.title}`,
    dueDate: new Date(
      Date.now() + (index + 1) * 2 * 86400000,
    ).toISOString(),
    moodleAssignmentId: `mdl-${1000 + index}`,
  }));

  return NextResponse.json({ assignments, source: "presets" });
}
