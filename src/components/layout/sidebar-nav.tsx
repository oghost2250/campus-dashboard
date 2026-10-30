"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { GraduationCap, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { navGroupsForUser } from "@/lib/nav";
import type { UserRole } from "@prisma/client";
import { useI18n } from "@/i18n/provider";

export function SidebarNav({
  scope,
  role,
  isDeveloper,
  onNavigate,
}: {
  /** Unique per mounted instance so layoutId animations don't collide. */
  scope: string;
  role: UserRole;
  isDeveloper: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const groups = navGroupsForUser(role, isDeveloper);

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-xl px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary via-primary to-chart-3 text-primary-foreground shadow-soft">
          <GraduationCap className="size-5" />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">
            {t.common.appName}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {t.common.tagline}
          </span>
        </span>
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.id} className="space-y-2">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {t.nav[group.id]}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "text-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId={`${scope}-nav-active`}
                          className="absolute inset-0 rounded-lg bg-sidebar-accent ring-1 ring-border/70"
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 34,
                          }}
                        />
                      )}
                      <item.icon
                        className={cn(
                          "relative size-4 transition-colors",
                          active
                            ? "text-primary"
                            : "text-muted-foreground/80 group-hover:text-foreground",
                        )}
                      />
                      <span className="relative truncate">
                        {t.nav[item.id]}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-primary/10 via-transparent to-transparent p-3">
        <ShieldCheck className="mb-1.5 size-4 text-primary" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t.auth.marketingFootnote}
        </p>
      </div>
    </div>
  );
}
