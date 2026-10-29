"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Check,
  Languages,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Palette,
  Save,
  Sun,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/i18n/provider";
import { signOutAction } from "@/app/actions/auth";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

const themes = [
  { value: "light", icon: Sun, key: "light" },
  { value: "dark", icon: Moon, key: "dark" },
  { value: "system", icon: Monitor, key: "system" },
] as const;

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "?"}${parts[1]?.[0] ?? ""}`
    .toUpperCase()
    .slice(0, 2);
}

export function SettingsView({
  user,
}: {
  user: { name: string | null; email: string; image: string | null };
}) {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState(user.name ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => setMounted(true), []);

  const activeTheme = mounted ? (theme ?? "system") : "system";

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return;

    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, locale }),
      });
      if (!response.ok) throw new Error("request failed");

      toast.success(t.settings.saved);
      router.refresh();
    } catch {
      toast.error(t.common.error);
    } finally {
      setSaving(false);
    }
  }

  function chooseLocale(next: Locale) {
    setLocale(next);
  }

  const themeLabels: Record<(typeof themes)[number]["value"], string> = {
    light: t.common.light,
    dark: t.common.dark,
    system: t.common.system,
  };

  const themePreviews: Record<(typeof themes)[number]["value"], string> = {
    light: "bg-[linear-gradient(180deg,#ffffff,#f1f2f8)]",
    dark: "bg-[linear-gradient(180deg,#1b1c26,#111219)]",
    system:
      "bg-[linear-gradient(115deg,#ffffff_0%,#eef0f8_48%,#1a1b24_52%,#101117_100%)]",
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.settings.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t.settings.subtitle}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-sm lg:col-span-2">
          <div className="flex items-center gap-2">
            <UserRound className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">
              {t.settings.profileTitle}
            </h2>
          </div>

          <form
            onSubmit={saveProfile}
            className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start"
          >
            <div className="flex items-center gap-3 sm:w-52 sm:flex-col sm:items-start">
              <Avatar className="size-14 ring-1 ring-border/70">
                {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                <AvatarFallback className="bg-primary/12 text-sm font-semibold text-primary">
                  {initials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {name.trim() || user.name || t.common.profile}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="grid flex-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">{t.settings.displayName}</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-email">{t.settings.emailLabel}</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
                  <Input
                    id="profile-email"
                    value={user.email}
                    disabled
                    readOnly
                    className="h-10 rounded-xl ps-9"
                    dir="ltr"
                  />
                  <Lock className="pointer-events-none absolute inset-y-0 end-3 my-auto size-3.5 text-muted-foreground/60" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t.settings.emailLocked}
                </p>
              </div>

              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={saving || name.trim().length < 2}
                  className="h-9 rounded-xl"
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {t.settings.saveProfile}
                </Button>
              </div>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">
              {t.settings.appearance}
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.settings.appearanceSubtitle}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {themes.map((item) => {
              const active = activeTheme === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTheme(item.value)}
                  aria-pressed={active}
                  className={cn(
                    "relative rounded-xl border p-2 text-start transition-all",
                    active
                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/70 hover:border-border hover:bg-muted/40",
                  )}
                >
                  <div
                    className={cn(
                      "mb-2 h-12 w-full rounded-lg border border-border/60",
                      themePreviews[item.value],
                    )}
                  />
                  <span className="flex items-center gap-1.5 px-0.5 text-[11px] font-medium">
                    <item.icon className="size-3.5" />
                    {themeLabels[item.value]}
                  </span>
                  {active ? (
                    <Check className="absolute end-2 top-2 size-3.5 rounded-full bg-background p-0.5 text-primary shadow-sm" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground">
            {t.settings.themeHint}
          </p>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Languages className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">
              {t.settings.languageTitle}
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.settings.languageSubtitle}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {(
              [
                { value: "en" as Locale, label: "English", hint: "LTR" },
                { value: "ar" as Locale, label: "العربية", hint: "RTL" },
              ] satisfies { value: Locale; label: string; hint: string }[]
            ).map((item) => {
              const active = locale === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => chooseLocale(item.value)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-3 py-2.5 transition-all",
                    active
                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/70 hover:border-border hover:bg-muted/40",
                  )}
                >
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {item.hint}
                    </span>
                    {active ? (
                      <Check className="size-3.5 text-primary" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground">
            {t.common.language}: {locale === "ar" ? "العربية" : "English"}
          </p>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                {t.settings.sessionTitle}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.settings.sessionSubtitle}
              </p>
              <Separator className="my-3" />
              <p className="text-xs text-muted-foreground" dir="ltr">
                {user.email}
              </p>
            </div>

            <form action={signOutAction}>
              <Button
                type="submit"
                variant="outline"
                className="h-9 rounded-xl text-destructive hover:text-destructive"
              >
                <LogOut className="size-4" />
                {t.common.signOut}
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
