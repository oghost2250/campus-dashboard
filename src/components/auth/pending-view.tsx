"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Clock3,
  GraduationCap,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { signOutAction } from "@/app/actions/auth";

export function PendingView({
  user,
  suspended,
}: {
  user: { name: string | null; email: string };
  suspended: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  const Icon = suspended ? ShieldAlert : Clock3;

  function checkAgain() {
    setChecking(true);
    router.refresh();
    window.setTimeout(() => setChecking(false), 1200);
  }

  return (
    <main className="relative grid min-h-dvh place-items-center bg-mesh px-5 py-10">
      <div className="absolute end-4 top-4 flex items-center gap-1">
        <LocaleToggle />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary via-primary to-chart-3 text-primary-foreground shadow-soft">
            <GraduationCap className="size-5" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            {t.common.appName}
          </span>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/80 p-7 shadow-soft backdrop-blur-xl">
          <span
            className={
              suspended
                ? "mb-4 grid size-11 place-items-center rounded-xl bg-destructive/10 text-destructive"
                : "mb-4 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"
            }
          >
            <Icon className="size-5" />
          </span>

          <h1 className="text-xl font-semibold tracking-tight">
            {suspended ? t.pending.suspendedTitle : t.pending.pendingTitle}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {suspended ? t.pending.suspendedBody : t.pending.pendingBody}
          </p>

          <div className="mt-5 rounded-xl border border-border/60 bg-muted/40 px-3.5 py-3 text-sm">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
              {t.pending.signedInAs}
            </p>
            <p className="mt-0.5 truncate font-medium">
              {user.name ?? user.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <Button
              type="button"
              onClick={checkAgain}
              disabled={checking}
              className="h-10 w-full rounded-xl"
            >
              {checking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {t.pending.checkAgain}
            </Button>

            <form action={signOutAction}>
              <Button
                type="submit"
                variant="outline"
                className="h-10 w-full rounded-xl"
              >
                <LogOut className="size-4" />
                {t.pending.signOut}
              </Button>
            </form>
          </div>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground/80">
            {t.pending.footnote}
          </p>
        </div>
      </div>
    </main>
  );
}
