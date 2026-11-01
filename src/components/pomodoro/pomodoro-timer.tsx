"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Coffee,
  Flame,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Timer,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/provider";
import { formatDate, formatTime } from "@/lib/format";
import type { FocusAnalyticsDTO, PomodoroDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AmbientSounds } from "@/components/pomodoro/ambient-sounds";

type Mode = "focus" | "short" | "long";

type Settings = {
  focus: number;
  short: number;
  long: number;
  sound: boolean;
  autoStart: boolean;
};

function clampMinutes(value: unknown, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(180, Math.max(1, Math.round(number)));
}

function playChime() {
  try {
    const context = new window.AudioContext();
    const now = context.currentTime;
    const notes = [659.25, 783.99, 1046.5];

    notes.forEach((frequency, index) => {
      const start = now + index * 0.16;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.3);
    });

    window.setTimeout(() => void context.close(), 1400);
  } catch {
    // Audio is a nicety — never block the timer.
  }
}

export function PomodoroTimer({
  todayMinutes: initialMinutes,
  todaySessions: initialSessions,
  recent: initialRecent,
  analytics: initialAnalytics,
  initialSettings,
}: {
  todayMinutes: number;
  todaySessions: number;
  recent: PomodoroDTO[];
  analytics: FocusAnalyticsDTO;
  initialSettings: Settings;
}) {
  const { t, locale } = useI18n();

  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [mode, setMode] = useState<Mode>("focus");
  const [remaining, setRemaining] = useState(initialSettings.focus * 60);
  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [label, setLabel] = useState("");
  const [todayMinutes, setTodayMinutes] = useState(initialMinutes);
  const [todaySessions, setTodaySessions] = useState(initialSessions);
  const [recent, setRecent] = useState(initialRecent);
  const [analytics, setAnalytics] = useState(initialAnalytics);

  const deadlineRef = useRef<number | null>(null);
  const startedAtRef = useRef<Date | null>(null);
  const finishRef = useRef<() => void>(() => {});
  const autoStartRef = useRef<number | null>(null);

  const durations = useMemo(
    () => ({
      focus: settings.focus * 60,
      short: settings.short * 60,
      long: settings.long * 60,
    }),
    [settings.focus, settings.short, settings.long],
  );

  const persistedSettings = useRef(JSON.stringify(initialSettings));

  useEffect(() => {
    const serialized = JSON.stringify(settings);
    if (serialized === persistedSettings.current) return;

    const timer = window.setTimeout(() => {
      persistedSettings.current = serialized;
      void fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pomodoroSettings: settings }),
      }).catch(() => {});
    }, 600);

    return () => window.clearTimeout(timer);
  }, [settings]);

  useEffect(() => {
    return () => {
      if (autoStartRef.current) window.clearTimeout(autoStartRef.current);
    };
  }, []);

  async function logSession(duration: number, startedAt: Date) {
    try {
      const response = await fetch("/api/pomodoro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || t.pomodoro.focus,
          durationMinutes: duration,
          wasCompleted: true,
          startedAt: startedAt.toISOString(),
          endedAt: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error("request failed");
    } catch {
      toast.error(t.common.error);
    }
  }

  function scheduleStart(seconds: number) {
    autoStartRef.current = window.setTimeout(() => {
      deadlineRef.current = Date.now() + seconds * 1000;
      startedAtRef.current = new Date();
      setRunning(true);
    }, 900);
  }

  function finishSession() {
    setRunning(false);
    deadlineRef.current = null;

    if (settings.sound) playChime();

    if (mode === "focus") {
      const started = startedAtRef.current ?? new Date(Date.now() - durations.focus * 1000);
      startedAtRef.current = null;
      const duration = settings.focus;

      setTodayMinutes((value) => value + duration);
      setTodaySessions((value) => value + 1);
      setRounds((value) => value + 1);

      const entry: PomodoroDTO = {
        id: `local-${Date.now()}`,
        label: label.trim() || t.pomodoro.focus,
        durationMinutes: duration,
        wasCompleted: true,
        startedAt: started.toISOString(),
      };
      setRecent((value) => [entry, ...value].slice(0, 8));

      setAnalytics((current) => {
        const previousToday =
          current.days[current.days.length - 1]?.minutes ?? 0;
        const days = current.days.map((day, index) =>
          index === current.days.length - 1
            ? {
                ...day,
                minutes: day.minutes + duration,
                sessions: day.sessions + 1,
              }
            : day,
        );

        return {
          days,
          totalMinutes: current.totalMinutes + duration,
          totalSessions: current.totalSessions + 1,
          bestDayMinutes: Math.max(current.bestDayMinutes, days[days.length - 1].minutes),
          streak: previousToday === 0 ? current.streak + 1 : current.streak,
        };
      });

      void logSession(duration, started);

      const nextRound = rounds + 1;
      const nextMode: Mode = nextRound % 4 === 0 ? "long" : "short";
      setMode(nextMode);
      setRemaining(durations[nextMode]);
      toast.success(t.pomodoro.sessionComplete);

      if (settings.autoStart) scheduleStart(durations[nextMode]);
    } else {
      setMode("focus");
      setRemaining(durations.focus);
      toast(t.pomodoro.breakComplete);

      if (settings.autoStart) scheduleStart(durations.focus);
    }
  }

  finishRef.current = finishSession;

  useEffect(() => {
    if (!running) return;

    const tick = () => {
      const deadline = deadlineRef.current;
      if (deadline === null) return;

      const left = deadline - Date.now();
      if (left <= 0) {
        setRemaining(0);
        finishRef.current();
        return;
      }

      setRemaining(Math.ceil(left / 1000));
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running]);

  const total = durations[mode];
  const elapsed = total > 0 ? 1 - remaining / total : 0;
  const circumference = 2 * Math.PI * 104;

  const modeLabel =
    mode === "focus"
      ? t.pomodoro.focus
      : mode === "short"
        ? t.pomodoro.shortBreak
        : t.pomodoro.longBreak;

  function selectMode(next: Mode) {
    if (autoStartRef.current) window.clearTimeout(autoStartRef.current);
    deadlineRef.current = null;
    startedAtRef.current = null;
    setRunning(false);
    setMode(next);
    setRemaining(durations[next]);
  }

  function toggleRunning() {
    if (running) {
      if (deadlineRef.current !== null) {
        setRemaining(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
      }
      deadlineRef.current = null;
      setRunning(false);
      return;
    }

    if (autoStartRef.current) window.clearTimeout(autoStartRef.current);

    const startSeconds = remaining > 0 ? remaining : durations[mode];
    setRemaining(startSeconds);
    deadlineRef.current = Date.now() + startSeconds * 1000;
    startedAtRef.current = new Date();
    setRunning(true);
  }

  function reset() {
    if (autoStartRef.current) window.clearTimeout(autoStartRef.current);
    deadlineRef.current = null;
    startedAtRef.current = null;
    setRunning(false);
    setRemaining(durations[mode]);
  }

  function skip() {
    if (autoStartRef.current) window.clearTimeout(autoStartRef.current);
    deadlineRef.current = null;
    startedAtRef.current = null;
    setRunning(false);
    const next: Mode = mode === "focus" ? "short" : "focus";
    setMode(next);
    setRemaining(durations[next]);
  }

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    const next = { ...settings, [key]: value };
    setSettings(next);

    if (!running && (key === "focus" || key === "short" || key === "long")) {
      setRemaining(next[mode] * 60);
    }
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.pomodoro.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t.pomodoro.subtitle}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-sm sm:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "radial-gradient(36rem 20rem at 50% -10%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%)",
            }}
          />

          <div className="relative flex flex-col items-center gap-6">
            <div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/60 p-1">
              {(["focus", "short", "long"] as Mode[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => selectMode(item)}
                  className={cn(
                    "relative rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                    mode === item
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mode === item ? (
                    <motion.span
                      layoutId="pomodoro-mode-pill"
                      className="absolute inset-0 rounded-full bg-card shadow-sm ring-1 ring-border/70"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <span className="relative">
                    {item === "focus"
                      ? t.pomodoro.focus
                      : item === "short"
                        ? t.pomodoro.shortBreak
                        : t.pomodoro.longBreak}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full max-w-[300px]">
              <svg viewBox="0 0 240 240" className="w-full -rotate-90">
                <defs>
                  <linearGradient
                    id="pomodoro-gradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="var(--primary)" />
                    <stop offset="100%" stopColor="var(--chart-3)" />
                  </linearGradient>
                </defs>
                <circle
                  cx="120"
                  cy="120"
                  r="104"
                  fill="none"
                  strokeWidth="10"
                  className="stroke-border/70"
                />
                <circle
                  cx="120"
                  cy="120"
                  r="104"
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  stroke="url(#pomodoro-gradient)"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - elapsed)}
                  className="transition-[stroke-dashoffset] duration-300 ease-linear"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {mode === "focus" ? (
                    <Flame className="size-3.5 text-primary" />
                  ) : (
                    <Coffee className="size-3.5 text-primary" />
                  )}
                  {modeLabel}
                </span>
                <span
                  className="font-mono text-[2.9rem] font-semibold leading-none tabular-nums tracking-tight"
                  aria-live="polite"
                >
                  {String(minutes).padStart(2, "0")}:
                  {String(seconds).padStart(2, "0")}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "size-1.5 rounded-full transition-colors",
                        index < rounds % 4
                          ? "bg-primary"
                          : "bg-muted-foreground/25",
                      )}
                    />
                  ))}
                  <span className="ms-1">
                    {rounds} {t.pomodoro.rounds}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex w-full max-w-sm items-center gap-2">
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={t.pomodoro.labelPlaceholder}
                aria-label={t.pomodoro.label}
                className="h-10 rounded-xl bg-background/60 text-center"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={toggleRunning}
                className="h-11 gap-2 rounded-full px-8 text-sm"
              >
                {running ? (
                  <>
                    <Pause className="size-4" />
                    {t.pomodoro.pause}
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    {remaining < total && remaining > 0
                      ? t.pomodoro.resume
                      : t.pomodoro.start}
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={reset}
                className="size-11 rounded-full"
                aria-label={t.pomodoro.reset}
              >
                <RotateCcw className="size-4" />
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={skip}
                className="size-11 rounded-full"
                aria-label={t.pomodoro.skip}
              >
                <SkipForward className="size-4" />
              </Button>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Timer className="size-3" />
                  {t.pomodoro.todayFocus}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {todayMinutes}
                  <span className="ms-1 text-[11px] font-normal text-muted-foreground">
                    {t.pomodoro.minutesShort}
                  </span>
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Flame className="size-3" />
                  {t.pomodoro.sessionsToday}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {todaySessions}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold tracking-tight">
                {t.pomodoro.settings}
              </p>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label
                    htmlFor="focus-length"
                    className="text-[10px] font-normal text-muted-foreground"
                  >
                    {t.pomodoro.focusLength}
                  </Label>
                  <Input
                    id="focus-length"
                    type="number"
                    min={1}
                    max={180}
                    value={settings.focus}
                    disabled={running}
                    onChange={(event) =>
                      updateSetting("focus", clampMinutes(event.target.value, 25))
                    }
                    className="h-9 rounded-lg px-2 text-center text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="short-length"
                    className="text-[10px] font-normal text-muted-foreground"
                  >
                    {t.pomodoro.breakLength}
                  </Label>
                  <Input
                    id="short-length"
                    type="number"
                    min={1}
                    max={60}
                    value={settings.short}
                    disabled={running}
                    onChange={(event) =>
                      updateSetting("short", clampMinutes(event.target.value, 5))
                    }
                    className="h-9 rounded-lg px-2 text-center text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="long-length"
                    className="text-[10px] font-normal text-muted-foreground"
                  >
                    {t.pomodoro.longBreakLength}
                  </Label>
                  <Input
                    id="long-length"
                    type="number"
                    min={1}
                    max={90}
                    value={settings.long}
                    disabled={running}
                    onChange={(event) =>
                      updateSetting("long", clampMinutes(event.target.value, 15))
                    }
                    className="h-9 rounded-lg px-2 text-center text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="sound-toggle"
                  className="flex items-center gap-2 text-xs font-normal"
                >
                  {settings.sound ? (
                    <Volume2 className="size-3.5 text-primary" />
                  ) : (
                    <VolumeX className="size-3.5 text-muted-foreground" />
                  )}
                  {settings.sound ? t.pomodoro.soundOn : t.pomodoro.soundOff}
                </Label>
                <Switch
                  id="sound-toggle"
                  checked={settings.sound}
                  onCheckedChange={(checked) => updateSetting("sound", checked)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="auto-toggle"
                  className="text-xs font-normal"
                >
                  {t.pomodoro.autoStart}
                </Label>
                <Switch
                  id="auto-toggle"
                  checked={settings.autoStart}
                  onCheckedChange={(checked) =>
                    updateSetting("autoStart", checked)
                  }
                />
              </div>

              <p className="text-[10px] leading-relaxed text-muted-foreground">
                {t.pomodoro.cycleHint}
              </p>
            </div>
          </section>

          <AmbientSounds />

          <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-sm">
            <p className="text-xs font-semibold tracking-tight">
              {t.pomodoro.recentSessions}
            </p>

            {recent.length === 0 ? (
              <p className="mt-3 text-[11px] text-muted-foreground">
                {t.pomodoro.noSessions}
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border/50">
                {recent.slice(0, 6).map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center gap-2 py-2 text-xs"
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-primary/60" />
                    <span className="min-w-0 flex-1 truncate">
                      {session.label}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {session.durationMinutes} {t.pomodoro.minutesShort} ·{" "}
                      {formatTime(session.startedAt, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-tight">
              {t.pomodoro.analyticsTitle}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {t.pomodoro.analyticsSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t.pomodoro.totalFocus}
              </p>
              <p className="text-sm font-semibold tabular-nums">
                {analytics.totalMinutes}
                <span className="ms-1 text-[10px] font-normal text-muted-foreground">
                  {t.pomodoro.minutesShort}
                </span>
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t.pomodoro.totalSessions}
              </p>
              <p className="text-sm font-semibold tabular-nums">
                {analytics.totalSessions}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t.pomodoro.streak}
              </p>
              <p className="text-sm font-semibold tabular-nums">
                {analytics.streak}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t.pomodoro.bestDay}
              </p>
              <p className="text-sm font-semibold tabular-nums">
                {analytics.bestDayMinutes}
                <span className="ms-1 text-[10px] font-normal text-muted-foreground">
                  {t.pomodoro.minutesShort}
                </span>
              </p>
            </div>
          </div>
        </div>

        {analytics.totalSessions === 0 ? (
          <p className="mt-6 text-[11px] text-muted-foreground">
            {t.pomodoro.noAnalytics}
          </p>
        ) : (
          <div className="mt-5 flex h-36 items-end gap-1.5">
            {analytics.days.map((day) => {
              const height =
                analytics.bestDayMinutes === 0
                  ? 0
                  : Math.round((day.minutes / analytics.bestDayMinutes) * 100);

              return (
                <div
                  key={day.date}
                  className="group flex min-w-0 flex-1 flex-col items-center gap-1.5"
                  title={`${formatDate(`${day.date}T00:00:00`, locale)} · ${day.minutes} ${t.pomodoro.minutesShort}`}
                >
                  <div className="flex h-28 w-full items-end">
                    <div
                      className={cn(
                        "w-full rounded-t-md transition-[height] duration-300",
                        day.minutes > 0
                          ? "bg-gradient-to-t from-primary/45 to-primary"
                          : "bg-muted",
                      )}
                      style={{
                        height: `${Math.max(day.minutes > 0 ? 6 : 3, height)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[9px] tabular-nums text-muted-foreground">
                    {day.date.slice(-2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
