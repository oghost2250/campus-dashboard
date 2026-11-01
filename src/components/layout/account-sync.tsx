"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";

/** Applies account-level preferences (theme, language) to a new device. */
export function AccountSync({
  theme,
  locale,
}: {
  theme: string | null;
  locale: string;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { locale: currentLocale } = useI18n();

  // Apply each server value once. Reacting to `currentTheme`/`currentLocale`
  // here would fight the user: the server prop stays stale until the next
  // refresh, so a toggle would be immediately reverted to the old value.
  const appliedTheme = useRef<string | null>(null);
  const appliedLocale = useRef<string | null>(null);

  useEffect(() => {
    if (!theme || appliedTheme.current === theme) return;
    appliedTheme.current = theme;
    setTheme(theme);
  }, [theme, setTheme]);

  useEffect(() => {
    if (!isLocale(locale) || appliedLocale.current === locale) return;
    appliedLocale.current = locale;

    const hasCookie = document.cookie
      .split(";")
      .some((entry) => entry.trim().startsWith(`${LOCALE_COOKIE}=`));
    if (!hasCookie) {
      document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
    }

    if (locale === currentLocale) return;
    router.refresh();
  }, [locale, currentLocale, router]);

  return null;
}
