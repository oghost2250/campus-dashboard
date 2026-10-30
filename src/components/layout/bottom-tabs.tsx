"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Library,
} from "lucide-react";

import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", id: "dashboard", icon: LayoutDashboard },
  { href: "/dashboard/assignments", id: "assignments", icon: ClipboardList },
  { href: "/dashboard/gpa", id: "gpa", icon: Calculator },
  { href: "/dashboard/schedule", id: "schedule", icon: CalendarDays },
  { href: "/dashboard/study-hub", id: "study", icon: Library },
] as const;

export function BottomTabs() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      aria-label={t.nav.overview}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map((tab) => {
          const active =
            tab.id === "study"
              ? ["/dashboard/study-hub", "/dashboard/pomodoro", "/dashboard/notes"].some(
                  (href) => pathname.startsWith(href),
                )
              : tab.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(tab.href);

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="size-5" />
                <span className="w-full truncate text-center">
                  {t.nav[tab.id]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
