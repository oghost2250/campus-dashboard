import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { endOfWeek, startOfToday } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";
import { computeCourseStats, computeGpa } from "@/lib/gpa";
import { parseClockPreference } from "@/lib/preferences";
import type { ScheduleAccent } from "@/lib/schedule";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.dashboard);
}

export default async function DashboardPage() {
  const user = await requireUser();
  const today = startOfToday();
  const weekEnd = endOfWeek();

  const [tasks, courses, focus, schedule] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
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

  const openTasks = tasks.filter((task) => task.status !== "DONE");

  const dueThisWeek = openTasks.filter(
    (task) => task.dueDate && task.dueDate <= weekEnd,
  ).length;

  const completed = tasks.filter((task) => task.status === "DONE").length;

  const { gpa } = computeGpa(
    courses.map((course) => ({
      credits: course.credits,
      stats: computeCourseStats(course.assessments, course.targetGrade),
    })),
    user.gpaScale === 5 ? 5 : 4,
  );

  const taskDeadlines = openTasks
    .filter((task) => task.dueDate !== null)
    .map((task) => ({
      key: `task-${task.id}`,
      title: task.title,
      subtitle: task.subject,
      dueDate: task.dueDate as Date,
      kind: "task" as const,
      type: null,
    }));

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

  const allDeadlines = [...taskDeadlines, ...assessmentDeadlines].sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime(),
  );

  const upcoming = allDeadlines.filter((item) => item.dueDate >= today);
  const nextDeadline = upcoming[0] ?? null;

  const thisWeek = upcoming
    .filter((item) => item.dueDate <= weekEnd)
    .slice(0, 6)
    .map((item) => ({ ...item, dueDate: item.dueDate.toISOString() }));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  return (
    <DashboardView
      name={user.name}
      greeting={greeting}
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
        assignment: tasks.length > 0,
        gpaScale: user.gpaScale !== null,
      }}
    />
  );
}
