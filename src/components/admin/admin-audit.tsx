"use client";

import { History } from "lucide-react";

import { useI18n } from "@/i18n/provider";
import { formatDateTime } from "@/lib/format";
import type { AdminAuditDTO } from "@/lib/types";

const tone: Record<string, string> = {
  USER_SUSPENDED: "text-destructive",
  USER_DELETED: "text-destructive",
  ROLE_PROMOTED_SUPER: "text-primary",
  ROLE_PROMOTED_ADMIN: "text-primary",
  USER_APPROVED: "text-success",
  USER_REACTIVATED: "text-success",
};

export function AdminAudit({ entries }: { entries: AdminAuditDTO[] }) {
  const { t, locale } = useI18n();
  const labels = t.admin.auditActions;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/70 shadow-soft backdrop-blur-xl">
      <div className="flex items-center gap-2 border-b border-border/60 p-4">
        <History className="size-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight">
          {t.admin.auditTitle}
        </h2>
      </div>

      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          {t.admin.auditEmpty}
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div className="min-w-0">
                <p
                  className={`truncate text-xs font-medium ${tone[entry.action] ?? "text-foreground"}`}
                >
                  {labels[entry.action as keyof typeof labels] ?? entry.action}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {entry.actor ?? "—"}
                  {entry.target ? ` · ${entry.target}` : ""}
                </p>
              </div>
              <time
                dateTime={entry.createdAt}
                className="shrink-0 text-[11px] text-muted-foreground"
              >
                {formatDateTime(entry.createdAt, locale)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
