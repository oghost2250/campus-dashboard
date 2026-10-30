"use client";

import { useEffect, useMemo, useState } from "react";

import {
  loadSchedule,
  saveSchedule,
  SCHEDULE_DAYS as DAYS,
  type ScheduleAccent as Accent,
  type ScheduleCourse as Course,
} from "@/lib/schedule";

const START_HOUR = 7;
const END_HOUR = 18; // 6 PM (12 hourly rows, 7 PM end)
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, index) => START_HOUR + index,
);

const TIME_OPTIONS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, index) => {
    const hour = START_HOUR + index;
    return `${String(hour).padStart(2, "0")}:00`;
  },
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

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + (minute || 0);
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:00 ${period}`;
}

export function WeeklySchedule({
  initialCourses = [],
}: {
  initialCourses?: Course[];
}) {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [hydrated, setHydrated] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importTerm, setImportTerm] = useState("Term 1");
  const [parsedRows, setParsedRows] = useState<
    { selected: boolean; course: Course }[]
  >([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<Course[] | null>(null);

  useEffect(() => {
    let active = true;
    void loadSchedule().then((saved) => {
      if (!active) return;
      setCourses(saved);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated) void saveSchedule(courses);
  }, [courses, hydrated]);

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

        const startHour = startMinutes / 60;
        const endHour = endMinutes / 60;

        const clampedStart = Math.max(startHour, START_HOUR);
        const clampedEnd = Math.min(endHour, END_HOUR + 1);
        if (clampedEnd <= clampedStart) return null;

        const rowStart = Math.round(clampedStart - START_HOUR) + 2;
        const rowSpan = Math.max(1, Math.round(clampedEnd - clampedStart));

        return {
          course,
          col: col + 2,
          rowStart,
          rowEnd: rowStart + rowSpan,
        };
      })
      .filter(Boolean) as {
      course: Course;
      col: number;
      rowStart: number;
      rowEnd: number;
    }[];
  }, [courses, dayIndex]);

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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      setError("Course title is required.");
      return;
    }
    if (toMinutes(form.endTime) <= toMinutes(form.startTime)) {
      setError("End time must be after start time.");
      return;
    }

    if (editingId) {
      setCourses((current) =>
        current.map((course) =>
          course.id === editingId
            ? {
                ...course,
                title: form.title.trim(),
                code: form.code.trim(),
                day: form.day,
                startTime: form.startTime,
                endTime: form.endTime,
                accent: form.accent,
                room: form.room.trim(),
                instructor: form.instructor.trim(),
              }
            : course,
        ),
      );
    } else {
      setCourses((current) => [
        ...current,
        {
          id: `course-${Date.now()}`,
          title: form.title.trim(),
          code: form.code.trim(),
          day: form.day,
          startTime: form.startTime,
          endTime: form.endTime,
          accent: form.accent,
          room: form.room.trim(),
          instructor: form.instructor.trim(),
        },
      ]);
    }

    closeModal();
  }

  function handleDelete() {
    if (!editingId) return;
    setCourses((current) => current.filter((course) => course.id !== editingId));
    closeModal();
  }

  // Register a tiny service worker so the schedule page + its last saved
  // data (IndexedDB) stay available offline.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is best-effort */
    });
  }, []);

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

  function normalizeTime(raw: string): string | null {
    const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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

      // Find a time range HH:MM-HH:MM (or en-dash).
      const timeMatch = line.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
      if (!day || !timeMatch) {
        skipped += 1;
        continue;
      }

      const startTime = normalizeTime(timeMatch[1]);
      const endTime = normalizeTime(timeMatch[2]);
      if (!startTime || !endTime) {
        skipped += 1;
        continue;
      }

      // Remove the day token and time range from the line to get the rest.
      const rest = line
        .replace(timeMatch[0], " ")
        .replace(new RegExp(`\\b${tokens[dayTokenIndex]}\\b`, "i"), " ")
        .trim();

      // Heuristics for code / room / instructor / title.
      const codeMatch = rest.match(/\b([A-Z]{2,}\s?\d{2,4}[A-Z]?)\b/);
      const code = codeMatch ? codeMatch[1].replace(/\s+/, " ") : "";
      const roomMatch = rest.match(/(?:room|rm|r\.?)\s*[:#-]?\s*([A-Za-z0-9-]+)/i);
      const room = roomMatch ? roomMatch[1] : "";
      const instrMatch = rest.match(/(?:dr\.?|prof\.?|instructor)\s+([A-Za-z][A-Za-z .'-]*)/i);
      const instructor = instrMatch ? instrMatch[1].trim() : "";

      let title = rest;
      if (code) title = title.replace(code, " ");
      if (roomMatch) title = title.replace(roomMatch[0], " ");
      if (instrMatch) title = title.replace(instrMatch[0], " ");
      title = title.replace(/\s+/g, " ").trim();
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
    setCourses(chosen);
    setImportOpen(false);
    setImportText("");
    setParsedRows([]);
  }

  function confirmReplace() {
    if (pendingImport) setCourses(pendingImport);
    setPendingImport(null);
    setConfirmReplaceOpen(false);
    setImportOpen(false);
    setImportText("");
    setParsedRows([]);
  }

  function clearSchedule() {
    if (window.confirm("Clear the entire schedule? This cannot be undone.")) {
      setCourses([]);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-gray-200">
            Weekly schedule
          </h2>
          <span className="text-[11px] text-gray-500">7:00 AM – 7:00 PM</span>
        </div>
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

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0a0a0a]">
        <div
          className="min-w-[920px]"
          style={{
            display: "grid",
            gridTemplateColumns: "80px repeat(7, minmax(120px, 1fr))",
            gridTemplateRows: `40px repeat(${HOURS.length}, 64px)`,
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
          {HOURS.map((hour, index) => (
            <div
              key={`time-${hour}`}
              className="flex items-start justify-end border-b border-r border-white/10 pr-3 pt-2 text-right text-xs tabular-nums text-zinc-400"
              style={{ gridColumn: 1, gridRow: index + 2 }}
            >
              {formatHour(hour)}
            </div>
          ))}
          {HOURS.flatMap((hour, index) =>
            DAYS.map((day, dayIndex) => (
              <div
                key={`${day}-${hour}`}
                className="border-b border-r border-white/10 last:border-r-0"
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
                "m-1 flex flex-col justify-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-left",
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
                {course.startTime} – {course.endTime}
              </span>
            </button>
          ))}
        </div>
      </div>

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
                  <select
                    value={form.startTime}
                    onChange={(event) =>
                      setForm((state) => ({
                        ...state,
                        startTime: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400">
                    End time
                  </label>
                  <select
                    value={form.endTime}
                    onChange={(event) =>
                      setForm((state) => ({
                        ...state,
                        endTime: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
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
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
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
                            {row.course.startTime} – {row.course.endTime}
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
