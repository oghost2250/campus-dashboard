import "server-only";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import type { UserRole } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Returns the authenticated, active user id, or null. Never trust a
 * body-supplied id.
 *
 * The status check is deliberately a database read: a suspended account still
 * holds a valid JWT, so the token alone is not enough to authorise writes.
 */
export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { status: true },
  });

  return user?.status === "ACTIVE" ? id : null;
}

export type ApiAdmin = { id: string; role: UserRole };

/** Returns the signed-in admin, or null for everyone else. */
export async function requireAdminUserId(): Promise<ApiAdmin | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, status: true },
  });

  if (!user || user.status !== "ACTIVE" || user.role !== "ADMIN") return null;

  return { id: user.id, role: user.role };
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
