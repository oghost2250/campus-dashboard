import { useMemo } from "react";

type Course = {
  id: string;
  title: string;
  day: string;
  startTime: string;
  endTime: string;
  accent?: "indigo" | "emerald" | "amber" | "rose";
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
const END_HOUR = 19; // 7 PM
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, index) => START_HOUR + index,
);

const MOCK_COURSES: Course[] = [
  {
    id: "c1",
    title: "Data Structures",
    day: "Monday",
    startTime: "09:00",
    endTime: "11:00",
    accent: "indigo",
  },
  {
    id: "c2",
    title: "Operating Systems",
    day: "Monday",
    startTime: "13:00",
    endTime: "14:00",
    accent: "emerald",
  },
  {
    id: "c3",
    title: "Linear Algebra",
    day: "Tuesday",
    startTime: "10:00",
    endTime: "12:00",
    accent: "indigo",
  },
  {
    id: "c4",
    title: "Database Systems",
    day: "Wednesday",
    startTime: "14:00",
    endTime: "16:00",
    accent: "amber",
  },
  {
    id: "c5",
    title: "Technical Writing",
    day: "Thursday",
    startTime: "08:00",
    endTime: "09:00",
    accent: "rose",
  },
  {
    id: "c6",
    title: "Algorithms Lab",
    day: "Friday",
    startTime: "11:00",
    endTime: "13:00",
    accent: "emerald",
  },
];

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + (minute || 0);
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:00 ${period}`;
}

const accentClasses: Record<NonNullable<Course["accent"]>, string> = {
  indigo: "border-l-indigo-500",
  emerald: "border-l-emerald-500",
  amber: "border-l-amber-500",
  rose: "border-l-rose-500",
};

export function WeeklySchedule({
  courses = MOCK_COURSES,
}: {
  courses?: Course[];
}) {
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

        // Clamp to the visible window.
        const clampedStart = Math.max(startHour, START_HOUR);
        const clampedEnd = Math.min(endHour, END_HOUR + 1);
        if (clampedEnd <= clampedStart) return null;

        const rowStart = Math.round((clampedStart - START_HOUR) * 1) + 2; // +2: header row + 1-based
        const rowSpan = Math.max(1, Math.round((clampedEnd - clampedStart) * 1));

        return {
          course,
          col: col + 2, // +2: time column is col 1, days start at col 2
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

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-gray-200">
          Weekly schedule
        </h2>
        <span className="text-[11px] text-gray-500">7:00 AM – 7:00 PM</span>
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
            <div
              key={course.id}
              className={[
                "m-1 flex flex-col justify-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5",
                "border-l-[3px]",
                accentClasses[course.accent ?? "indigo"],
                "shadow-sm",
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
                {course.startTime} – {course.endTime}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-400">
        <span className="size-2 rounded-full bg-indigo-500" />
        Registered
      </div>
    </div>
  );
}

export default WeeklySchedule;
