"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  GraduationCap,
  MapPin,
  NotebookPen,
  Plus,
  Sparkles,
  Timer,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { daysUntil, formatDate } from "@/lib/format";
import {
  loadSchedule,
  SCHEDULE_DAYS,
  type ScheduleCourse,
} from "@/lib/schedule";
import type { StatsDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

type DeadlineItem = {
  key: string;
  title: string;
  subtitle: string;
  dueDate: string;
  kind: "task" | "assessment";
  type: string | null;
};

type Props = {
  name: string | null;
  greeting: "morning" | "afternoon" | "evening";
  isoDate: string;
  stats: StatsDTO;
  nextDeadline: DeadlineItem | null;
  thisWeek: DeadlineItem[];
  onboarding: {
    courses: boolean;
    assignment: boolean;
    gpaScale: boolean;
  };
};

const rise = {
  hidden: { opacity: 0, y: 12 },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.04 * index, duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + (minute || 0);
}

function clock(value: string, locale: "en" | "ar"): string {
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date(2000, 0, 1, hour || 0, minute || 0);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function DashboardView({
  name,
  greeting,
  isoDate,
  stats,
  nextDeadline,
  thisWeek,
  onboarding,
}: Props) {
  const { t, locale } = useI18n();
  const firstName = (name ?? "").split(" ")[0];
  const [schedule, setSchedule] = useState<ScheduleCourse[] | null>(null);

  useEffect(() => {
    let active = true;
    void loadSchedule().then((saved) => {
      if (active) setSchedule(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  const greetingText =
    greeting === "morning"
      ? t.dashboard.greetingMorning
      : greeting === "afternoon"
        ? t.dashboard.greetingAfternoon
        : t.dashboard.greetingEvening;

  const todayName = SCHEDULE_DAYS[new Date().getDay()];
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const todayClasses = (schedule ?? [])
    .filter((course) => course.day === todayName)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  const nextClassId =
    todayClasses.find((course) => toMinutes(course.endTime) > nowMinutes)?.id ??
    null;

  const setupSteps = [
    {
      key: "courses",
      label: t.dashboard.stepAddCourses,
      href: "/dashboard/gpa",
      done: onboarding.courses,
    },
    {
      key: "schedule",
      label: t.dashboard.stepAddSchedule,
      href: "/dashboard/schedule",
      done: schedule !== null && schedule.length > 0,
    },
    {
      key: "assignment",
      label: t.dashboard.stepAddAssignment,
      href: "/dashboard/tasks",
      done: onboarding.assignment,
    },
    {
      key: "gpaScale",
      label: t.dashboard.stepSetGpaScale,
      href: "/dashboard/settings",
      done: onboarding.gpaScale,
    },
  ];
  const setupDone = setupSteps.filter((step) => step.done).length;
  const showSetup = schedule !== null && setupDone < setupSteps.length;

  const tiles = [
    {
      label: t.dashboard.dueSoon,
      value: stats.dueThisWeek,
      icon: CalendarClock,
      tint: "from-primary/16 to-primary/4 text-primary",
      href: null,
      linkLabel: "",
    },
    {
      label: t.dashboard.completedTasks,
      value: stats.completed,
      icon: CheckCircle2,
      tint: "from-emerald-500/16 to-emerald-500/4 text-emerald-500",
      href: null,
      linkLabel: "",
    },
    {
      label: t.dashboard.currentGpa,
      value: stats.gpa === null ? "—" : stats.gpa.toFixed(2),
      icon: GraduationCap,
      tint: "from-sky-500/16 to-sky-500/4 text-sky-500",
      href: stats.gpa === null ? "/dashboard/gpa" : null,
      linkLabel: t.dashboard.addCourses,
    },
    {
      label: t.dashboard.focusMinutes,
      value: stats.focusMinutes,
      icon: Timer,
      tint: "from-amber-500/18 to-amber-500/4 text-amber-500",
      href: null,
      linkLabel: "",
    },
  ];

  const quickActions = [
    { href: "/dashboard/tasks", label: t.dashboard.newTask, icon: Plus },
    { href: "/dashboard/gpa", label: t.dashboard.openGpa, icon: GraduationCap },
    { href: "/dashboard/pomodoro", label: t.dashboard.startFocus, icon: Timer },
    {
      href: "/dashboard/notes",
      label: t.dashboard.openScratchpad,
      icon: NotebookPen,
    },
  ];

  const countdown = nextDeadline ? daysUntil(nextDeadline.dueDate) : null;
  const countdownText =
    countdown === null
      ? null
      : countdown < 0
        ? t.dashboard.overdue
        : countdown === 0
          ? t.dashboard.today
          : countdown === 1
            ? t.dashboard.tomorrow
            : `${countdown} ${t.dashboard.daysLeft}`;

  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {formatDate(isoDate, locale, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
            {greetingText}
            {firstName ? (
              <>
                ,{" "}
                <span className="bg-gradient-to-r from-primary to-chart-3 bg-clip-text text-transparent">
                  {firstName}
                </span>
              </>
            ) : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.dashboard.subtitle}
          </p>
        </div>

        <Button asChild className="h-9 rounded-xl">
          <Link href="/dashboard/tasks">
            <Plus className="size-4" />
            {t.tasks.new}
          </Link>
        </Button>
      </motion.header>

      {showSetup ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 shadow-soft backdrop-blur-sm sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold tracking-tight">
                  {t.dashboard.setupTitle}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t.dashboard.setupSubtitle}
                </p>
              </div>
            </div>
            <span className="rounded-lg bg-background/70 px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground ring-1 ring-border/60">
              {setupDone}/{setupSteps.length} {t.dashboard.setupDone}
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {setupSteps.map((step) => (
              <Link
                key={step.key}
                href={step.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                  step.done
                    ? "border-border/50 bg-muted/30 text-muted-foreground"
                    : "border-border/70 bg-card/70 hover:border-primary/30 hover:bg-card",
                )}
              >
                {step.done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground/60" />
                )}
                <span
                  className={cn(
                    "flex-1 truncate",
                    step.done && "line-through decoration-border",
                  )}
                >
                  {step.label}
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/50 rtl-flip" />
              </Link>
            ))}
          </div>
        </motion.section>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile, index) => (
          <motion.div
            key={tile.label}
            custom={index}
            variants={rise}
            initial="hidden"
            animate="show"
            className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-soft backdrop-blur-sm"
          >
            <div
              className={cn(
                "mb-3 grid size-9 place-items-center rounded-xl bg-gradient-to-br",
                tile.tint,
              )}
            >
              <tile.icon className="size-[18px]" />
            </div>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {tile.value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{tile.label}</p>
            {tile.href ? (
              <Link
                href={tile.href}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {tile.linkLabel}
                <ArrowRight className="size-3 rtl-flip" />
              </Link>
            ) : null}
          </motion.div>
        ))}
      </div>

      <motion.section
        custom={3}
        variants={rise}
        initial="hidden"
        animate="show"
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-3 shadow-soft backdrop-blur-sm"
      >
        {nextDeadline && countdownText ? (
          <>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <CalendarClock className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t.dashboard.nextDeadline}
              </p>
              <p className="truncate text-sm font-medium">{nextDeadline.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {nextDeadline.subtitle} ·{" "}
                {formatDate(nextDeadline.dueDate, locale, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <Badge
              variant={countdown !== null && countdown <= 1 ? "default" : "secondary"}
              className="shrink-0 rounded-lg px-3 py-1 text-xs font-medium"
            >
              {countdownText}
            </Badge>
          </>
        ) : (
          <>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="size-[18px]" />
            </span>
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              {t.dashboard.noDeadline}
            </p>
            <Button asChild size="sm" variant="outline" className="rounded-xl">
              <Link href="/dashboard/tasks">
                <Plus className="size-3.5" />
                {t.dashboard.addAssignment}
              </Link>
            </Button>
          </>
        )}
      </motion.section>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.section
          custom={4}
          variants={rise}
          initial="hidden"
          animate="show"
          className="rounded-2xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-sm lg:col-span-2"
        >
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="text-sm font-semibold tracking-tight">
              {t.dashboard.todayClasses}
            </h2>
            <Link
              href="/dashboard/schedule"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t.common.viewAll}
              <ArrowRight className="size-3.5 rtl-flip" />
            </Link>
          </div>

          {schedule === null ? (
            <div className="space-y-2 p-5">
              <div className="h-12 animate-pulse rounded-xl bg-muted/60" />
              <div className="h-12 animate-pulse rounded-xl bg-muted/40" />
            </div>
          ) : todayClasses.length === 0 ? (
            <div className="m-5 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                {t.dashboard.noClassesToday}
              </p>
              <Button asChild size="sm" variant="outline" className="rounded-xl">
                <Link href="/dashboard/schedule">
                  <Plus className="size-3.5" />
                  {t.dashboard.addSchedule}
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/60 px-5 py-2">
              {todayClasses.map((course) => {
                const isNext = course.id === nextClassId;
                return (
                  <li
                    key={course.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-2 py-3 transition-colors",
                      isNext && "bg-primary/5 ring-1 ring-primary/20",
                    )}
                  >
                    <div className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                      <p className="font-medium text-foreground">
                        {clock(course.startTime, locale)}
                      </p>
                      <p>{clock(course.endTime, locale)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {course.title}
                        </p>
                        {isNext ? (
                          <Badge
                            variant="default"
                            className="shrink-0 rounded-md px-1.5 py-0 text-[10px] font-medium"
                          >
                            {t.dashboard.next}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {course.code}
                      </p>
                      {course.room || course.instructor ? (
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {course.room ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" />
                              {course.room}
                            </span>
                          ) : null}
                          {course.instructor ? (
                            <span className="inline-flex items-center gap-1">
                              <UserRound className="size-3" />
                              {course.instructor}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.section>

        <motion.section
          custom={5}
          variants={rise}
          initial="hidden"
          animate="show"
          className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-sm"
        >
          <h2 className="text-sm font-semibold tracking-tight">
            {t.dashboard.quickActions}
          </h2>
          <div className="mt-4 grid gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-3 rounded-xl border border-transparent bg-muted/40 px-3 py-2.5 text-sm transition-colors hover:border-border hover:bg-muted"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-background text-primary shadow-sm ring-1 ring-border/60">
                  <action.icon className="size-4" />
                </span>
                <span className="flex-1 truncate">{action.label}</span>
                <ArrowRight className="size-3.5 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 rtl-flip" />
              </Link>
            ))}
          </div>
        </motion.section>
      </div>

      <motion.section
        custom={6}
        variants={rise}
        initial="hidden"
        animate="show"
        className="rounded-2xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-sm"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-sm font-semibold tracking-tight">
            {t.dashboard.thisWeek}
          </h2>
          <Link
            href="/dashboard/tasks"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {t.common.viewAll}
            <ArrowRight className="size-3.5 rtl-flip" />
          </Link>
        </div>

        {thisWeek.length === 0 ? (
          <div className="m-5 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t.dashboard.noThisWeek}
            </p>
            <Button asChild size="sm" variant="outline" className="rounded-xl">
              <Link href="/dashboard/tasks">
                <Plus className="size-3.5" />
                {t.dashboard.addAssignment}
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border/60 px-5 py-2">
            {thisWeek.map((item) => (
              <li key={item.key} className="flex items-center gap-3 py-3">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl",
                    item.kind === "assessment"
                      ? "bg-amber-500/10 text-amber-500"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {item.kind === "assessment" ? (
                    <GraduationCap className="size-4" />
                  ) : (
                    <Clock className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.subtitle}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="shrink-0 rounded-md font-normal"
                >
                  {item.kind === "assessment"
                    ? t.dashboard.exam
                    : t.dashboard.assignment}
                </Badge>
                <span className="w-16 shrink-0 text-end text-xs tabular-nums text-muted-foreground">
                  {formatDate(item.dueDate, locale, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </motion.section>
    </div>
  );
}
