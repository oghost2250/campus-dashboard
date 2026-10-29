import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { pageMetadata } from "@/lib/metadata";
import { syllabusTopicDTO } from "@/lib/serialize";
import { SyllabusTracker } from "@/components/syllabus/syllabus-tracker";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.syllabus);
}

export default async function SyllabusPage() {
  const user = await requireUser();

  const topics = await prisma.syllabusTopic.findMany({
    where: { userId: user.id },
    orderBy: [{ course: "asc" }, { createdAt: "asc" }],
  });

  return <SyllabusTracker initialTopics={topics.map(syllabusTopicDTO)} />;
}
