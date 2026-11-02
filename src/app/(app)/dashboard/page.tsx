import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { endOfWeek, startOfToday } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";
import { computeCourseStats, computeGpa } from "@/lib/gpa";
import { parseClockPreference } from "@/lib/preferences";
import type { ScheduleAccent } from "@/lib/schedule";
import { DashboardView } from "@/components/dashboard/dashboard-view";

/**
 * Weekday and minute-of-day in the campus time zone.
 *
 * Computing these on the server keeps the SSR output and the hydrated client
 * identical; deriving them in the browser from `new Date()` mismatches when the
 * server runs in UTC and the student is in Cairo.
 */
function zonedNow(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const rawHour = Number(read("hour"));
  const hour = rawHour === 24 ? 0 : rawHour;

  return {
    weekday: read("weekday"),
    hour,
    minutes: hour * 60 + Number(read("minute")),
  };
}

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.dashboard);
}

export default async function DashboardPage() {
  const user = await requireUser();
  const today = startOfToday();
  const weekEnd = endOfWeek();

  const [completed, dueThisWeek, taskCount, taskDeadlines, courses, focus, schedule] = await Promise.all([
    prisma.task.count({ where: { userId: user.id, status: "DONE" } }),
    prisma.task.count({
      where: { userId: user.id, status: { not: "DONE" }, dueDate: { lte: weekEnd } },
    }),
    prisma.task.count({ where: { userId: user.id } }),
    prisma.task.findMany({
      where: { userId: user.id, status: { not: "DONE" }, dueDate: { gte: today } },
      select: { id: true, title: true, subject: true, dueDate: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.course.findMany({
      where: { userId: user.id },
      select: {
        name: true,
        credits: true,
        targetGrade: true,
        assessments: {
          select: {
            id: true,
            name: true,
            type: true,
            weight: true,
            score: true,
            maxScore: true,
            dueDate: true,
          },
        },
      },
    }),
    prisma.pomodoroSession.aggregate({
      where: {
        userId: user.id,
        wasCompleted: true,
        startedAt: { gte: today },
      },
      _sum: { durationMinutes: true },
      _count: true,
    }),
    prisma.scheduleCourse.findMany({
      where: { userId: user.id },
      orderBy: [{ startTime: "asc" }],
    }),
  ]);

  const upcomingTaskDeadlines = taskDeadlines.map((task) => ({
      key: `task-${task.id}`,
      title: task.title,
      subtitle: task.subject,
      dueDate: task.dueDate as Date,
      kind: "task" as const,
      type: null,
    }));

  const { gpa } = computeGpa(
    courses.map((course) => ({
      credits: course.credits,
      stats: computeCourseStats(course.assessments, course.targetGrade),
    })),
    user.gpaScale === 5 ? 5 : 4,
  );

  const assessmentDeadlines = courses.flatMap((course) =>
    course.assessments
      .filter((assessment) => assessment.dueDate !== null)
      .map((assessment) => ({
        key: `assessment-${assessment.id}`,
        title: assessment.name,
        subtitle: course.name,
        dueDate: assessment.dueDate as Date,
        kind: "assessment" as const,
        type: assessment.type,
      })),
  );

  const allDeadlines = [...upcomingTaskDeadlines, ...assessmentDeadlines].sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime(),
  );

  const upcoming = allDeadlines.filter((item) => item.dueDate >= today);
  const nextDeadline = upcoming[0] ?? null;

  const thisWeek = upcoming
    .filter((item) => item.dueDate <= weekEnd)
    .slice(0, 6)
    .map((item) => ({ ...item, dueDate: item.dueDate.toISOString() }));

  const { weekday, minutes, hour } = zonedNow(env.APP_TIME_ZONE);
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  return (
    <DashboardView
      name={user.name}
      greeting={greeting}
      todayName={weekday}
      nowMinutes={minutes}
      isoDate={new Date().toISOString()}
      stats={{
        dueThisWeek,
        completed,
        gpa,
        focusMinutes: focus._sum.durationMinutes ?? 0,
        focusSessions: focus._count,
      }}
      nextDeadline={
        nextDeadline
          ? { ...nextDeadline, dueDate: nextDeadline.dueDate.toISOString() }
          : null
      }
      thisWeek={thisWeek}
      schedule={schedule.map((course) => ({
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
      onboarding={{
        courses: courses.length > 0,
        assignment: taskCount > 0,
        gpaScale: user.gpaScale !== null,
      }}
    />
  );
}
