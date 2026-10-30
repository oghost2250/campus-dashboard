"use client";

import { useMemo, useState } from "react";

type Accent = "indigo" | "emerald" | "blue" | "amber";

type Course = {
  id: string;
  title: string;
  code: string;
  day: string;
  startTime: string;
  endTime: string;
  accent: Accent;
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

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

const MOCK_COURSES: Course[] = [
  {
    id: "c1",
    title: "Data Structures",
    code: "CSAI 211",
    day: "Monday",
    startTime: "09:00",
    endTime: "11:00",
    accent: "indigo",
  },
  {
    id: "c2",
    title: "Operating Systems",
    code: "CSAI 340",
    day: "Monday",
    startTime: "13:00",
    endTime: "14:00",
    accent: "emerald",
  },
  {
    id: "c3",
    title: "Linear Algebra",
    code: "MATH 241",
    day: "Tuesday",
    startTime: "10:00",
    endTime: "12:00",
    accent: "indigo",
  },
  {
    id: "c4",
    title: "Database Systems",
    code: "CS 361",
    day: "Wednesday",
    startTime: "14:00",
    endTime: "16:00",
    accent: "amber",
  },
  {
    id: "c5",
    title: "Technical Writing",
    code: "ENGL 102",
    day: "Thursday",
    startTime: "08:00",
    endTime: "09:00",
    accent: "blue",
  },
  {
    id: "c6",
    title: "Algorithms Lab",
    code: "CS 220",
    day: "Friday",
    startTime: "11:00",
    endTime: "13:00",
    accent: "emerald",
  },
];

const emptyForm = {
  title: "",
  code: "",
  day: "Sunday",
  startTime: "08:00",
  endTime: "09:00",
  accent: "indigo" as Accent,
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
  initialCourses = MOCK_COURSES,
}: {
  initialCourses?: Course[];
}) {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

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
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0a0a0a]">
        <div
          className="grid min-w-[920px]"
          style={{
            gridTemplateColumns: "84px repeat(7, minmax(128px, 1fr))",
            gridTemplateRows: `40px repeat(${HOURS.length}, 64px)`,
          }}
        >
          {/* Corner cell */}
          <div className="border-b border-r border-white/10 bg-zinc-900/60" />

          {/* Day headers */}
          {DAYS.map((day) => (
            <div
              key={day}
              className="flex items-center justify-center border-b border-r border-white/10 bg-zinc-900/60 text-xs font-medium text-gray-300 last:border-r-0"
            >
              {day}
            </div>
          ))}

          {/* Time labels + empty cells */}
          {HOURS.map((hour) => (
            <div key={`row-${hour}`} className="contents">
              <div className="flex items-start justify-end border-b border-r border-white/10 pr-3 pt-2 text-[11px] tabular-nums text-gray-500">
                {formatHour(hour)}
              </div>
              {DAYS.map((day) => (
                <div
                  key={`${day}-${hour}`}
                  className="border-b border-r border-white/10 last:border-r-0"
                />
              ))}
            </div>
          ))}

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
    </div>
  );
}

export default WeeklySchedule;
