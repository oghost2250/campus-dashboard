import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Prisma, UserRole, UserStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/roles";
import { LOCALE_COOKIE, defaultLocale, isLocale, type Locale } from "@/i18n/config";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(value)) return value;

  // No cookie on this device yet: fall back to what the account last used.
  const user = await getCurrentUser();
  return user && isLocale(user.locale) ? user.locale : defaultLocale;
}

export type SessionUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  locale: string;
  theme: string | null;
  timeFormat: string;
  pomodoroSettings: Prisma.JsonValue | null;
  gpaScale: number | null;
  isDeveloper: boolean;
  role: UserRole;
  status: UserStatus;
  approvedAt: Date | null;
};

/**
 * The authoritative user record for this request, or null when signed out.
 *
 * Cached with React's `cache()` so a layout + page that both need the user only
 * hit the database once. Role/status live in the database rather than the JWT,
 * so an approval or suspension takes effect on the very next request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      locale: true,
      theme: true,
      timeFormat: true,
      pomodoroSettings: true,
      gpaScale: true,
      isDeveloper: true,
      role: true,
      status: true,
      approvedAt: true,
    },
  });
});

/**
 * Server components / pages: redirect unauthenticated visitors to /login.
 * Middleware already blocks /dashboard, this is defence in depth for nested
 * layouts and direct RSC requests.
 *
 * Pending and suspended accounts can sign in, but only get the /pending page
 * until an admin activates them.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.status !== "ACTIVE") {
    redirect(user.status === "SUSPENDED" ? "/pending?state=suspended" : "/pending");
  }

  return user;
}

/** Pages and layouts that require a minimum role (admin or super admin). */
export async function requireRole(minimum: UserRole): Promise<SessionUser> {
  const user = await requireUser();

  if (!hasRole(user.role, minimum)) {
    redirect("/dashboard");
  }

  return user;
}

/** Pages and layouts that only admins (or super admins) may open. */
export async function requireAdmin(): Promise<SessionUser> {
  return requireRole("ADMIN");
}
