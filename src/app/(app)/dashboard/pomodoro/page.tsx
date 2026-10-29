import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { startOfToday } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";
import { pomodoroDTO } from "@/lib/serialize";
import { PomodoroTimer } from "@/components/pomodoro/pomodoro-timer";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.pomodoro);
}

export default async function PomodoroPage() {
  const user = await requireUser();
  const since = startOfToday();

  const [today, recent] = await Promise.all([
    prisma.pomodoroSession.aggregate({
      where: {
        userId: user.id,
        wasCompleted: true,
        startedAt: { gte: since },
      },
      _sum: { durationMinutes: true },
      _count: true,
    }),
    prisma.pomodoroSession.findMany({
      where: { userId: user.id, wasCompleted: true },
      orderBy: { startedAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <PomodoroTimer
      todayMinutes={today._sum.durationMinutes ?? 0}
      todaySessions={today._count}
      recent={recent.map(pomodoroDTO)}
    />
  );
}
