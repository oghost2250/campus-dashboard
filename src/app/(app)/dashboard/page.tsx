import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { endOfWeek, startOfToday } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";
import { taskDTO, snippetDTO } from "@/lib/serialize";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.dashboard);
}

export default async function DashboardPage() {
  const user = await requireUser();
  const today = startOfToday();
  const weekEnd = endOfWeek();

  const [tasks, snippets, snippetCount, focus] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.snippet.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 3,
    }),
    prisma.snippet.count({ where: { userId: user.id } }),
    prisma.pomodoroSession.aggregate({
      where: {
        userId: user.id,
        wasCompleted: true,
        startedAt: { gte: today },
      },
      _sum: { durationMinutes: true },
      _count: true,
    }),
  ]);

  const openTasks = tasks.filter((task) => task.status !== "DONE");

  const dueThisWeek = openTasks.filter(
    (task) => task.dueDate && task.dueDate <= weekEnd,
  ).length;

  const completed = tasks.filter((task) => task.status === "DONE").length;

  const upcoming = openTasks
    .filter((task) => task.dueDate !== null)
    .slice(0, 5)
    .map(taskDTO);

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
        snippetCount,
        focusMinutes: focus._sum.durationMinutes ?? 0,
        focusSessions: focus._count,
      }}
      upcoming={upcoming}
      recentSnippets={snippets.map(snippetDTO)}
    />
  );
}
