"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Code2,
  NotebookPen,
  Plus,
  Timer,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { formatDate } from "@/lib/format";
import { languageLabel } from "@/lib/languages";
import type { SnippetDTO, StatsDTO, TaskDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  name: string | null;
  greeting: "morning" | "afternoon" | "evening";
  isoDate: string;
  stats: StatsDTO;
  upcoming: TaskDTO[];
  recentSnippets: SnippetDTO[];
};

const rise = {
  hidden: { opacity: 0, y: 12 },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.04 * index, duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function DashboardView({
  name,
  greeting,
  isoDate,
  stats,
  upcoming,
  recentSnippets,
}: Props) {
  const { t, locale } = useI18n();
  const firstName = (name ?? "").split(" ")[0];

  const greetingText =
    greeting === "morning"
      ? t.dashboard.greetingMorning
      : greeting === "afternoon"
        ? t.dashboard.greetingAfternoon
        : t.dashboard.greetingEvening;

  const tiles = [
    {
      label: t.dashboard.dueSoon,
      value: stats.dueThisWeek,
      icon: CalendarClock,
      tint: "from-primary/16 to-primary/4 text-primary",
    },
    {
      label: t.dashboard.completedTasks,
      value: stats.completed,
      icon: CheckCircle2,
      tint: "from-emerald-500/16 to-emerald-500/4 text-emerald-500",
    },
    {
      label: t.dashboard.snippetsSaved,
      value: stats.snippetCount,
      icon: Code2,
      tint: "from-sky-500/16 to-sky-500/4 text-sky-500",
    },
    {
      label: t.dashboard.focusMinutes,
      value: stats.focusMinutes,
      icon: Timer,
      tint: "from-amber-500/18 to-amber-500/4 text-amber-500",
    },
  ];

  const quickActions = [
    { href: "/dashboard/tasks", label: t.dashboard.newTask, icon: Plus },
    { href: "/dashboard/snippets", label: t.dashboard.newSnippet, icon: Code2 },
    { href: "/dashboard/pomodoro", label: t.dashboard.startFocus, icon: Timer },
    {
      href: "/dashboard/notes",
      label: t.dashboard.openScratchpad,
      icon: NotebookPen,
    },
  ];

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
          </motion.div>
        ))}
      </div>

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
              {t.dashboard.upcoming}
            </h2>
            <Link
              href="/dashboard/tasks"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t.common.viewAll}
              <ArrowRight className="size-3.5 rtl-flip" />
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <div className="m-5 rounded-xl border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
              {t.dashboard.noUpcoming}
            </div>
          ) : (
            <ul className="divide-y divide-border/60 px-5 py-2">
              {upcoming.map((task) => {
                const due = task.dueDate
                  ? formatDate(task.dueDate, locale, {
                      month: "short",
                      day: "numeric",
                    })
                  : t.tasks.noDueDate;

                return (
                  <li
                    key={task.id}
                    className="flex items-center gap-3 py-3"
                  >
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        task.priority === "HIGH"
                          ? "bg-destructive"
                          : task.priority === "MEDIUM"
                            ? "bg-warning"
                            : "bg-muted-foreground/40",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {task.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {task.subject}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="shrink-0 rounded-md font-normal"
                    >
                      {due}
                    </Badge>
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
            {t.dashboard.recentSnippets}
          </h2>
          <Link
            href="/dashboard/snippets"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {t.common.viewAll}
            <ArrowRight className="size-3.5 rtl-flip" />
          </Link>
        </div>

        {recentSnippets.length === 0 ? (
          <div className="m-5 rounded-xl border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
            {t.dashboard.noSnippets}
          </div>
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {recentSnippets.map((snippet) => (
              <Link
                key={snippet.id}
                href="/dashboard/snippets"
                className="group rounded-xl border border-border/70 bg-background/60 p-4 transition-all hover:border-primary/30 hover:shadow-soft"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">
                    {snippet.title}
                  </p>
                  <Code2 className="size-3.5 shrink-0 text-muted-foreground/60" />
                </div>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {languageLabel(snippet.language)}
                </p>
                {snippet.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {snippet.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
