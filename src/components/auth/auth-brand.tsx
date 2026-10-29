"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { useI18n } from "@/i18n/provider";

/** Brand row shown on mobile, where the marketing panel is hidden. */
export function AuthBrand() {
  const { t } = useI18n();

  return (
    <Link
      href="/login"
      className="inline-flex items-center gap-2.5 lg:hidden"
      aria-label={t.common.appName}
    >
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-chart-3 text-primary-foreground shadow-soft">
        <GraduationCap className="size-5" />
      </span>
      <span className="text-sm font-semibold tracking-tight">
        {t.common.appName}
      </span>
    </Link>
  );
}
