import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { pageMetadata } from "@/lib/metadata";
import { courseDTO } from "@/lib/serialize";
import { GpaWorkspace } from "@/components/gpa/gpa-workspace";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.gpa);
}

export default async function GpaPage() {
  const user = await requireUser();

  const courses = await prisma.course.findMany({
    where: { userId: user.id },
    include: { assessments: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  return <GpaWorkspace initialCourses={courses.map(courseDTO)} />;
}
