import "server-only";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import type { UserRole, UserStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/roles";

/**
 * Short-lived per-instance cache for the "is this account active?" read.
 *
 * Every API request used to issue a second query to fetch the user's status.
 * With a few thousand students that doubles the database read volume for no
 * benefit. A 15 second window keeps suspensions responsive while cutting the
 * majority of the duplicate reads. Admin checks deliberately bypass this cache
 * and always read the database.
 */
const STATUS_TTL_MS = 15_000;
const STATUS_CACHE_MAX = 10_000;

type StatusEntry = { status: UserStatus; expiresAt: number };
const statusCache = new Map<string, StatusEntry>();

async function lookupStatus(id: string): Promise<UserStatus | null> {
  const now = Date.now();
  const cached = statusCache.get(id);
  if (cached && cached.expiresAt > now) return cached.status;

  if (statusCache.size > STATUS_CACHE_MAX) {
    for (const [key, entry] of statusCache) {
      if (entry.expiresAt <= now) statusCache.delete(key);
    }
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!user) {
    statusCache.delete(id);
    return null;
  }

  statusCache.set(id, { status: user.status, expiresAt: now + STATUS_TTL_MS });
  return user.status;
}

/** Call after an admin changes a user's status so the change applies instantly. */
export function invalidateUserStatus(id: string) {
  statusCache.delete(id);
}

/**
 * Returns the authenticated, active user id, or null. Never trust a
 * body-supplied id.
 *
 * The status check is deliberately a database read (cached briefly): a
 * suspended account still holds a valid JWT, so the token alone is not enough
 * to authorise writes.
 */
export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const status = await lookupStatus(id);
  return status === "ACTIVE" ? id : null;
}

export type ApiAdmin = { id: string; role: UserRole };

/** Returns the signed-in account with at least `minimum`, or null. Fresh read. */
export async function requireRoleUserId(
  minimum: UserRole,
): Promise<ApiAdmin | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, status: true },
  });

  if (!user || user.status !== "ACTIVE" || !hasRole(user.role, minimum)) {
    return null;
  }

  return { id: user.id, role: user.role };
}

/** Returns the signed-in admin (or super admin), or null. Always fresh. */
export async function requireAdminUserId(): Promise<ApiAdmin | null> {
  return requireRoleUserId("ADMIN");
}

/** True when the user is an active admin or super admin. */
export async function isAdminUser(id: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { role: true, status: true },
  });
  return Boolean(user && user.status === "ACTIVE" && hasRole(user.role, "ADMIN"));
}

export function unauthorized() {
  return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
}

export function forbidden(error = "FORBIDDEN") {
  return NextResponse.json({ error }, { status: 403 });
}

export function conflict(error = "CONFLICT") {
  return NextResponse.json({ error }, { status: 409 });
}

export function notFound() {
  return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}

export function badRequest(message = "BAD_REQUEST") {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function invalid(error: ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return NextResponse.json(
    { error: "VALIDATION_ERROR", fieldErrors },
    { status: 422 },
  );
}

/** Accepts "YYYY-MM-DD" or an ISO string. Invalid input becomes null. */
export function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Offset pagination for list endpoints. Caps the page size so a single client
 * cannot ask the database for an unbounded result set.
 */
export function readPagination(
  request: Request,
  defaultLimit = 200,
  maxLimit = 500,
): { limit: number; offset: number } {
  const params = new URL(request.url).searchParams;

  const rawLimit = Number(params.get("limit"));
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), maxLimit)
    : defaultLimit;

  const rawOffset = Number(params.get("offset"));
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0 ? Math.trunc(rawOffset) : 0;

  return { limit, offset };
}
