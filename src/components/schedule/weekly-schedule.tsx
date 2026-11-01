"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { loadPersisted, savePersisted } from "@/lib/browser-store";
import { ClassAlarmsToggle } from "@/components/notifications/class-alarms-toggle";
import { useI18n } from "@/i18n/provider";
import {
  SCHEDULE_DAYS as DAYS,
  SCHEDULE_MIGRATED_KEY,
  SCHEDULE_STORAGE_KEY,
  type ScheduleAccent as Accent,
  type ScheduleCourse as Course,
} from "@/lib/schedule";
import {
  formatClock,
  formatClockRange,
  parseTimeInput,
  toMinutes,
  type ClockFormat,
} from "@/lib/time";

const START_HOUR = 7;
const END_HOUR = 23;
const START_MINUTES = START_HOUR * 60;
const END_MINUTES = (END_HOUR + 1) * 60;
/** Half-hour rows so imported :30 classes land on the right line. */
const SLOT_MINUTES = 30;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, index) => START_HOUR + index,
);
const SLOTS = Array.from(
  { length: (END_MINUTES - START_MINUTES) / SLOT_MINUTES },
  (_, index) => START_MINUTES + index * SLOT_MINUTES,
);

const ACCENT_OPTIONS: { value: Accent; label: string; className: string }[] = [
  { value: "indigo", label: "Purple", className: "bg-indigo-500" },
  { value: "emerald", label: "Green", className: "bg-emerald-500" },
  { value: "blue", label: "Blue", className: "bg-blue-500" },
  { value: "amber", label: "Amber", className: "bg-amber-500" },
];

const accentBorder: Record<Accent, string> = {
  indigo: "border-l-indigo-500",
  emerald: "border-l-emerald-500",
  blue: "border-l-blue-500",
  amber: "border-l-amber-500",
};

const emptyForm = {
  title: "",
  code: "",
  day: "Sunday",
  startTime: "08:00",
  endTime: "09:00",
  accent: "indigo" as Accent,
  room: "",
  instructor: "",
};

function coursePayload(course: Course) {
  return {
    title: course.title,
    code: course.code,
    day: course.day,
    startTime: course.startTime,
    endTime: course.endTime,
    accent: course.accent,
    room: course.room ?? null,
    instructor: course.instructor ?? null,
    term: course.term ?? null,
  };
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? "Could not save your changes.");
  }
  return (await response.json()) as T;
}

export function WeeklySchedule({
  initialCourses = [],
  timeFormat = "12h",
  pushPublicKey = null,
}: {
  initialCourses?: Course[];
  timeFormat?: ClockFormat;
  pushPublicKey?: string | null;
}) {
  const { locale } = useI18n();
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importTerm, setImportTerm] = useState("Term 1");
  const [parsedRows, setParsedRows] = useState<
    { selected: boolean; course: Course }[]
  >([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<Course[] | null>(null);

  // One-time move of any schedule that is still only in this browser.
  useEffect(() => {
    let active = true;

    async function migrate() {
      if (initialCourses.length === 0) {
        const migrated = await loadPersisted<boolean>(SCHEDULE_MIGRATED_KEY);
        if (!migrated) {
          const legacy = await loadPersisted<Course[]>(SCHEDULE_STORAGE_KEY);
          if (Array.isArray(legacy) && legacy.length > 0) {
            try {
              const saved = await apiRequest<{ courses: Course[] }>(
                "/api/schedule",
                {
                  method: "PUT",
                  body: JSON.stringify(legacy.map(coursePayload)),
                },
              );
              if (active) {
                setCourses(saved.courses);
                toast.success(
                  `Restored ${legacy.length} classes from this browser`,
                );
              }
            } catch {
              return; // retry on the next visit
            }
          }
        }
      }
      await savePersisted(SCHEDULE_STORAGE_KEY, []);
      await savePersisted(SCHEDULE_MIGRATED_KEY, true);
    }

    void migrate();
    return () => {
      active = false;
    };
  }, [initialCourses.length]);

  // Old builds registered a service worker that cached the page; clear it so
  // the account-synced schedule is always freshly rendered.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(
          registrations
            .filter((entry) => entry.active?.scriptURL.endsWith("/sw.js"))
            .map((entry) => entry.unregister()),
        ),
      )
      .catch(() => {});
    if (typeof caches !== "undefined") void caches.delete("campus-schedule-v1");
  }, []);

  const dayIndex = useMemo(() => {
    const map = new Map<string, number>();
    DAYS.forEach((day, index) => map.set(day, index));
    return map;
  }, []);

  const placed = useMemo(() => {
    return courses
      .map((course) => {
        const col = dayIndex.get(course.day);
        if (col === undefined) return null;

        const startMinutes = toMinutes(course.startTime);
        const endMinutes = toMinutes(course.endTime);
        if (endMinutes <= startMinutes) return null;

        const clampedStart = Math.max(startMinutes, START_MINUTES);
        const clampedEnd = Math.min(endMinutes, END_MINUTES);
        if (clampedEnd <= clampedStart) return null;

        const startSlot = Math.min(
          SLOTS.length - 1,
          Math.round((clampedStart - START_MINUTES) / SLOT_MINUTES),
        );
        const endSlot = Math.min(
          SLOTS.length,
          Math.max(
            startSlot + 1,
            Math.round((clampedEnd - START_MINUTES) / SLOT_MINUTES),
          ),
        );

        const rowStart = startSlot + 2;
        const rowEnd = endSlot + 2;

        return {
          course,
          col: col + 2,
          rowStart,
          rowEnd,
        };
      })
      .filter(Boolean) as {
      course: Course;
      col: number;
      rowStart: number;
      rowEnd: number;
    }[];
  }, [courses, dayIndex]);

  const outside = useMemo(() => {
    const placedIds = new Set(placed.map((item) => item.course.id));
    return courses.filter((course) => !placedIds.has(course.id));
  }, [courses, placed]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(course: Course) {
    setEditingId(course.id);
    setForm({
      title: course.title,
      code: course.code,
      day: course.day,
      startTime: course.startTime,
      endTime: course.endTime,
      accent: course.accent,
      room: course.room ?? "",
      instructor: course.instructor ?? "",
    });
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!form.title.trim()) {
      setError("Course title is required.");
      return;
    }
    if (toMinutes(form.endTime) <= toMinutes(form.startTime)) {
      setError("End time must be after start time.");
      return;
    }

    const payload = coursePayload({
      ...form,
      id: editingId ?? "",
      title: form.title.trim(),
      code: form.code.trim(),
      room: form.room.trim(),
      instructor: form.instructor.trim(),
    });

    setPending(true);
    try {
      if (editingId) {
        const saved = await apiRequest<{ course: Course }>(
          `/api/schedule/${editingId}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setCourses((current) =>
          current.map((course) =>
            course.id === editingId ? saved.course : course,
          ),
        );
      } else {
        const saved = await apiRequest<{ course: Course }>("/api/schedule", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setCourses((current) => [...current, saved.course]);
      }
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!editingId || pending) return;
    if (!window.confirm("Delete this class? This cannot be undone.")) return;
    setPending(true);
    try {
      await apiRequest(`/api/schedule/${editingId}`, { method: "DELETE" });
      setCourses((current) =>
        current.filter((course) => course.id !== editingId),
      );
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setPending(false);
    }
  }

  const DAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const DAY_ALIASES: Record<string, string> = {
    sun: "Sunday",
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
  };

  function normalizeDay(raw: string): string | null {
    const lower = raw.trim().toLowerCase().replace(/\.$/, "");
    if (DAY_ALIASES[lower]) return DAY_ALIASES[lower];
    const full = DAY_NAMES.find((d) => d.toLowerCase() === lower);
    return full ?? null;
  }

  function parseScheduleText(text: string) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows: { selected: boolean; course: Course }[] = [];
    let skipped = 0;

    for (const line of lines) {
      // Find a day token anywhere in the line.
      const tokens = line.split(/[\s,;|]+/).filter(Boolean);
      let day: string | null = null;
      let dayTokenIndex = -1;
      for (let i = 0; i < tokens.length; i += 1) {
        const candidate = normalizeDay(tokens[i]);
        if (candidate) {
          day = candidate;
          dayTokenIndex = i;
          break;
        }
      }

      // Find a time range like "09:00-10:30" or "9 AM - 10:30 AM".
      const timeMatch = line.match(
        /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
      );
      if (!day || !timeMatch) {
        skipped += 1;
        continue;
      }

      const startTime = parseTimeInput(timeMatch[1]);
      const endTime = parseTimeInput(timeMatch[2]);
      if (!startTime || !endTime) {
        skipped += 1;
        continue;
      }

      // Remove the day token and time range from the line to get the rest.
      const rest = line
        .replace(timeMatch[0], " ")
        .replace(new RegExp(`\\b${tokens[dayTokenIndex]}\\b`, "i"), " ")
        .trim();

      // Heuristics for code / room / instructor / title. Each match is removed
      // from `working` so it cannot be stolen by the next pattern.
      const codeMatch = rest.match(/\b([A-Z]{2,}\s?\d{2,4}[A-Z]?)\b/);
      const code = codeMatch ? codeMatch[1].replace(/\s+/, " ") : "";
      const roomMatch = rest.match(
        /(?:\broom\b|\brm\b|\br\.)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9-]*)/i,
      );
      const room = roomMatch ? roomMatch[1] : "";

      let working = rest;
      if (code) working = working.replace(code, " ");
      if (roomMatch) working = working.replace(roomMatch[0], " ");

      const instrMatch = working.match(
        /(?:\bdr\.?|\bprof\.?|\binstructor\b)\s+([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,2})/i,
      );
      const instructor = instrMatch ? instrMatch[1].trim() : "";
      if (instrMatch) working = working.replace(instrMatch[0], " ");

      let title = working.replace(/[\s,;|]+/g, " ").trim();
      if (!title) title = code || "Untitled course";

      const accents: Course["accent"][] = ["indigo", "emerald", "blue", "amber"];
      const course: Course = {
        id: `imported-${Date.now()}-${rows.length}`,
        title,
        code,
        day,
        startTime,
        endTime,
        accent: accents[rows.length % accents.length],
        room,
        instructor,
        term: importTerm,
      };

      rows.push({ selected: true, course });
    }

    setParsedRows(rows);
    setSkippedCount(skipped);
  }

  function handleImportClick() {
    parseScheduleText(importText);
  }

  function applyImport() {
    const chosen = parsedRows.filter((r) => r.selected).map((r) => r.course);
    if (chosen.length === 0) return;
    if (courses.length > 0) {
      setPendingImport(chosen);
      setConfirmReplaceOpen(true);
      return;
    }
    void persistImport(chosen);
  }

  async function persistImport(chosen: Course[]) {
    if (chosen.length === 0 || pending) return;
    setPending(true);
    try {
      const saved = await apiRequest<{ courses: Course[] }>("/api/schedule", {
        method: "PUT",
        body: JSON.stringify(chosen.map(coursePayload)),
      });
      setCourses(saved.courses);
      setImportOpen(false);
      setImportText("");
      setParsedRows([]);
      toast.success(`Saved ${saved.courses.length} classes to your account`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setPending(false);
      setPendingImport(null);
      setConfirmReplaceOpen(false);
    }
  }

  function confirmReplace() {
    if (!pendingImport) return;
    void persistImport(pendingImport);
  }

  async function clearSchedule() {
    if (!window.confirm("Clear the entire schedule? This cannot be undone.")) {
      return;
    }
    setPending(true);
    try {
      await apiRequest("/api/schedule", { method: "DELETE" });
      setCourses([]);
      toast.success("Schedule cleared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not clear.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-gray-200">
            Weekly schedule
          </h2>
          <span className="text-[11px] text-gray-500">
            {formatClock("07:00", timeFormat, locale)} –{" "}
            {formatClock("00:00", timeFormat, locale)}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ClassAlarmsToggle publicKey={pushPublicKey} />
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
          >
            <span className="text-base leading-none">+</span>
            Add course
          </button>
          <button
            type="button"
            onClick={() => {
              setImportOpen(true);
              setParsedRows([]);
              setSkippedCount(0);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-zinc-700"
          >
            Import
          </button>
          <button
            type="button"
            onClick={clearSchedule}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/20"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0a0a0a]">
        <div
          className="min-w-[920px]"
          style={{
            display: "grid",
            gridTemplateColumns: "80px repeat(7, minmax(120px, 1fr))",
            gridTemplateRows: `40px repeat(${SLOTS.length}, 32px)`,
          }}
        >
          {/* Corner cell */}
          <div
            className="border-b border-r border-white/10 bg-zinc-900/60"
            style={{ gridColumn: 1, gridRow: 1 }}
          />

          {/* Day headers */}
          {DAYS.map((day, index) => (
            <div
              key={day}
              className="flex items-center justify-center border-b border-r border-white/10 bg-zinc-900/60 text-xs font-medium text-gray-300 last:border-r-0"
              style={{ gridColumn: index + 2, gridRow: 1 }}
            >
              {day}
            </div>
          ))}

          {/* Each time label is a direct grid item pinned to the first column. */}
          {HOURS.map((hour) => (
            <div
              key={`time-${hour}`}
              className="flex items-start justify-end border-b border-r border-white/10 pr-3 pt-1 text-right text-[10px] tabular-nums text-zinc-400"
              style={{
                gridColumn: 1,
                gridRow: (hour - START_HOUR) * (60 / SLOT_MINUTES) + 2,
              }}
            >
              {formatClock(`${String(hour).padStart(2, "0")}:00`, timeFormat, locale)}
            </div>
          ))}
          {SLOTS.flatMap((slot, index) =>
            DAYS.map((day, dayIndex) => (
              <div
                key={`${day}-${slot}`}
                className={[
                  "border-r border-white/10 last:border-r-0",
                  index % 2 === 0
                    ? "border-b border-white/10"
                    : "border-b border-white/5",
                ].join(" ")}
                style={{
                  gridColumn: dayIndex + 2,
                  gridRow: index + 2,
                }}
              />
            )),
          )}

          {/* Course cards */}
          {placed.map(({ course, col, rowStart, rowEnd }) => (
            <button
              key={course.id}
              type="button"
              onClick={() => openEdit(course)}
              className={[
                "m-1 flex flex-col justify-center gap-0.5 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-1 text-left",
                "border-l-[3px]",
                accentBorder[course.accent],
                "shadow-sm transition-colors hover:bg-zinc-800/80",
              ].join(" ")}
              style={{
                gridColumn: col,
                gridRow: `${rowStart} / ${rowEnd}`,
                zIndex: 10,
              }}
            >
              <span className="truncate text-xs font-medium text-gray-200">
                {course.title}
              </span>
              <span className="truncate text-[10px] text-gray-400">
                {course.code ? `${course.code} · ` : ""}
                {formatClockRange(course.startTime, course.endTime, timeFormat, locale)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {outside.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <span className="text-[11px] text-amber-300">
            Outside the visible grid
          </span>
          {outside.map((course) => (
            <button
              key={course.id}
              type="button"
              onClick={() => openEdit(course)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] text-gray-200 transition-colors hover:bg-zinc-700"
            >
              {course.day} ·{" "}
              {formatClockRange(course.startTime, course.endTime, timeFormat, locale)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-400">
        <span className="size-2 rounded-full bg-indigo-500" />
        Registered
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">
                {editingId ? "Edit course" : "Add course"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-500 transition-colors hover:text-gray-200"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400">
                  Course title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, title: event.target.value }))
                  }
                  placeholder="e.g. Data Structures"
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400">
                  Course code
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, code: event.target.value }))
                  }
                  placeholder="e.g. CSAI 112"
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400">
                    Room
                  </label>
                  <input
                    type="text"
                    value={form.room}
                    onChange={(event) =>
                      setForm((state) => ({ ...state, room: event.target.value }))
                    }
                    placeholder="e.g. B-204"
                    className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400">
                    Instructor
                  </label>
                  <input
                    type="text"
                    value={form.instructor}
                    onChange={(event) =>
                      setForm((state) => ({
                        ...state,
                        instructor: event.target.value,
                      }))
                    }
                    placeholder="e.g. Dr. Hassan"
                    className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400">
                  Day of week
                </label>
                <select
                  value={form.day}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, day: event.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  {DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400">
                    Start time
                  </label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                      setForm((state) => ({
                        ...state,
                        startTime: event.target.value,
                      }))
                    }
                    step={60}
                    required
                    className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white [color-scheme:dark] focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400">
                    End time
                  </label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) =>
                      setForm((state) => ({
                        ...state,
                        endTime: event.target.value,
                      }))
                    }
                    step={60}
                    required
                    className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white [color-scheme:dark] focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400">
                  Accent color
                </label>
                <div className="flex gap-2">
                  {ACCENT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setForm((state) => ({ ...state, accent: option.value }))
                      }
                      className={[
                        "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] transition-colors",
                        form.accent === option.value
                          ? "border-indigo-500 bg-zinc-800 text-white"
                          : "border-zinc-700 bg-zinc-800/50 text-gray-400 hover:border-zinc-600",
                      ].join(" ")}
                    >
                      <span className={`size-2.5 rounded-full ${option.className}`} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-[11px] text-rose-400" role="alert">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between gap-2 pt-2">
                {editingId ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/20"
                  >
                    Delete
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {editingId ? "Save changes" : "Add course"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
{/* Import dialog */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">Import schedule</h3>
              <button
                type="button"
                onClick={() => { setImportOpen(false); setParsedRows([]); }}
                className="text-gray-500 transition-colors hover:text-gray-200"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-[11px] font-medium text-gray-400">Term</label>
                <select
                  value={importTerm}
                  onChange={(event) => setImportTerm(event.target.value)}
                  className="h-9 rounded-lg border border-zinc-700 bg-zinc-800 px-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  {["Term 1", "Term 2", "Term 3", "Summer"].map((term) => (
                    <option key={term} value={term}>{term}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder="Paste your schedule here (one class per line)…"
                className="h-40 w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-xs text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleImportClick}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
                >
                  Parse
                </button>
                {skippedCount > 0 && (
                  <span className="text-[11px] text-rose-400">
                    {skippedCount} row{skippedCount === 1 ? "" : "s"} skipped (unrecognized).
                  </span>
                )}
              </div>
              {parsedRows.length > 0 && (
                <div className="max-h-60 overflow-auto rounded-lg border border-zinc-800">
                  <table className="w-full text-xs text-gray-200">
                    <thead className="bg-zinc-800 text-gray-400">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Use</th>
                        <th className="px-2 py-1.5 text-left">Course</th>
                        <th className="px-2 py-1.5 text-left">Day</th>
                        <th className="px-2 py-1.5 text-left">Time</th>
                        <th className="px-2 py-1.5 text-left">Room</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, index) => (
                        <tr key={index} className="border-t border-zinc-800">
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={(event) =>
                                setParsedRows((current) =>
                                  current.map((r, i) =>
                                    i === index ? { ...r, selected: event.target.checked } : r,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            {row.course.title}
                            {row.course.code ? " (" + row.course.code + ")" : ""}
                          </td>
                          <td className="px-2 py-1.5">{row.course.day}</td>
                          <td className="px-2 py-1.5">
                            {formatClockRange(row.course.startTime, row.course.endTime, timeFormat, locale)}
                          </td>
                          <td className="px-2 py-1.5">{row.course.room}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {parsedRows.length > 0 && (
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setImportOpen(false); setParsedRows([]); }}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={applyImport}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
                  >
                    Import selected
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm replace dialog */}
      {confirmReplaceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-gray-200">Replace schedule?</h3>
            <p className="mt-2 text-xs text-gray-400">
              This will replace your {courses.length} existing class{courses.length === 1 ? "" : "es"} with the imported ones.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setConfirmReplaceOpen(false); setPendingImport(null); }}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReplace}
                className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-rose-500"
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default WeeklySchedule;
