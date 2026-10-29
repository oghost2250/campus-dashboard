"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Loader2, Lock, Mail, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/provider";
import { GoogleIcon } from "@/components/auth/google-icon";
import { AuthBrand } from "@/components/auth/auth-brand";

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const { t } = useI18n();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t.errors.validation);
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;

        setError(
          payload?.error === "EMAIL_TAKEN"
            ? t.auth.emailTaken
            : payload?.error === "EMAIL_DOMAIN"
              ? t.auth.emailDomain
              : t.errors.validation,
        );
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        router.push("/login");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError(t.common.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-7">
      <AuthBrand />

      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.auth.signUpTitle}
        </h1>
        <p className="text-sm text-muted-foreground">{t.auth.signUpSubtitle}</p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-soft backdrop-blur-xl">
        {googleEnabled ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full gap-2.5 rounded-xl text-sm font-medium"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            >
              <GoogleIcon />
              {t.auth.continueWithGoogle}
            </Button>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t.auth.orContinueWith}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name">{t.auth.name}</Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
              <Input
                id="name"
                name="name"
                autoComplete="name"
                required
                minLength={2}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t.auth.namePlaceholder}
                className="h-11 rounded-xl ps-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">{t.auth.email}</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t.auth.emailPlaceholder}
                className="h-11 rounded-xl ps-10"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="password">{t.auth.password}</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t.auth.passwordPlaceholder}
                  className="h-11 rounded-xl px-9"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 end-2 my-auto grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">{t.auth.confirmPassword}</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={t.auth.passwordPlaceholder}
                  className="h-11 rounded-xl ps-10"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {t.auth.passwordHint}
          </p>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={pending}
            className="h-11 w-full rounded-xl text-sm font-medium"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t.auth.creatingAccount}
              </>
            ) : (
              t.auth.signUp
            )}
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {t.auth.haveAccount}{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          {t.auth.signIn}
        </Link>
      </p>
    </div>
  );
}
