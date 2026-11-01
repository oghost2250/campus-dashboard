import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { env, isPushConfigured } from "@/lib/env";
import { parseClockPreference } from "@/lib/preferences";
import { pageMetadata } from "@/lib/metadata";
import { WeeklySchedule } from "@/components/schedule/weekly-schedule";
import type { ScheduleAccent } from "@/lib/schedule";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.schedule);
}

export default async function SchedulePage() {
  const user = await requireUser();

  const courses = await prisma.scheduleCourse.findMany({
    where: { userId: user.id },
    orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
  });

  return (
    <WeeklySchedule
      initialCourses={courses.map((course) => ({
        id: course.id,
        title: course.title,
        code: course.code,
        day: course.day,
        startTime: course.startTime,
        endTime: course.endTime,
        accent: course.accent as ScheduleAccent,
        room: course.room,
        instructor: course.instructor,
        term: course.term,
      }))}
      timeFormat={parseClockPreference(user.timeFormat)}
      pushPublicKey={
        isPushConfigured ? env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null : null
      }
    />
  );
}
