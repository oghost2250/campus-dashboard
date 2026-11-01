export type ThemePreference = "light" | "dark" | "system";
export type ClockPreference = "12h" | "24h";

export type PomodoroSettings = {
  focus: number;
  short: number;
  long: number;
  sound: boolean;
  autoStart: boolean;
};

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focus: 25,
  short: 5,
  long: 15,
  sound: true,
  autoStart: false,
};

function clampMinutes(value: unknown, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(180, Math.max(1, Math.round(number)));
}

/** Normalises the JSON blob stored on the user row. */
export function parsePomodoroSettings(value: unknown): PomodoroSettings {
  if (!value || typeof value !== "object") return DEFAULT_POMODORO_SETTINGS;
  const raw = value as Partial<PomodoroSettings>;
  return {
    focus: clampMinutes(raw.focus, DEFAULT_POMODORO_SETTINGS.focus),
    short: clampMinutes(raw.short, DEFAULT_POMODORO_SETTINGS.short),
    long: clampMinutes(raw.long, DEFAULT_POMODORO_SETTINGS.long),
    sound:
      typeof raw.sound === "boolean"
        ? raw.sound
        : DEFAULT_POMODORO_SETTINGS.sound,
    autoStart: raw.autoStart === true,
  };
}

export function parseClockPreference(value: unknown): ClockPreference {
  return value === "24h" ? "24h" : "12h";
}

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}
