import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { CourseAssignments } from "@/components/assignments/course-assignments";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.assignments);
}

export default function AssignmentsPage() {
  return <CourseAssignments />;
}
