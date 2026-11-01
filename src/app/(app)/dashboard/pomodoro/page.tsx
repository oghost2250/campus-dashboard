import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { startOfToday } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";
import { parsePomodoroSettings } from "@/lib/preferences";
import { pomodoroDTO } from "@/lib/serialize";
import { PomodoroTimer } from "@/components/pomodoro/pomodoro-timer";
import type { FocusAnalyticsDTO, FocusDayDTO } from "@/lib/types";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.pomodoro);
}

const DAY_MS = 86_400_000;
const HISTORY_DAYS = 14;

/** Local `YYYY-MM-DD` key, matching how sessions are bucketed below. */
function dateKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function buildAnalytics(
  sessions: { startedAt: Date; durationMinutes: number }[],
): FocusAnalyticsDTO {
  const today = startOfToday();
  const days: FocusDayDTO[] = [];

  for (let offset = HISTORY_DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date(today.getTime() - offset * DAY_MS);
    days.push({ date: dateKey(date), minutes: 0, sessions: 0 });
  }

  const indexByKey = new Map(days.map((day, index) => [day.date, index]));

  for (const session of sessions) {
    const index = indexByKey.get(dateKey(session.startedAt));
    if (index === undefined) continue;
    days[index].minutes += session.durationMinutes;
    days[index].sessions += 1;
  }

  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0);
  const totalSessions = days.reduce((sum, day) => sum + day.sessions, 0);
  const bestDayMinutes = days.reduce(
    (best, day) => Math.max(best, day.minutes),
    0,
  );

  // A streak may start today or yesterday, then run backwards unbroken.
  let cursor = days.length - 1;
  if (days[cursor]?.minutes === 0) cursor -= 1;
  let streak = 0;
  while (cursor >= 0 && days[cursor].minutes > 0) {
    streak += 1;
    cursor -= 1;
  }

  return { days, totalMinutes, totalSessions, streak, bestDayMinutes };
}

export default async function PomodoroPage() {
  const user = await requireUser();
  const since = startOfToday();

  const [today, recent, history] = await Promise.all([
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
    prisma.pomodoroSession.findMany({
      where: {
        userId: user.id,
        wasCompleted: true,
        startedAt: { gte: new Date(since.getTime() - (HISTORY_DAYS - 1) * DAY_MS) },
      },
      select: { startedAt: true, durationMinutes: true },
      orderBy: { startedAt: "asc" },
    }),
  ]);

  return (
    <PomodoroTimer
      todayMinutes={today._sum.durationMinutes ?? 0}
      todaySessions={today._count}
      recent={recent.map(pomodoroDTO)}
      analytics={buildAnalytics(history)}
      initialSettings={parsePomodoroSettings(user.pomodoroSettings)}
    />
  );
}
