import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma, UserRole, UserStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  forbidden,
  invalid,
  readJson,
  requireAdminUserId,
} from "@/lib/api";
import { adminUserDTO } from "@/lib/serialize";
import { adminCreateUserSchema } from "@/lib/validations/admin";
import type { AdminUsersResponse } from "@/lib/types";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;

const userInclude = {
  _count: {
    select: { tasks: true, courses: true, snippets: true, notes: true },
  },
} as const;

function parseEnum<T extends string>(
  values: readonly T[],
  value: string | null,
): T | undefined {
  return value && values.includes(value as T) ? (value as T) : undefined;
}

/**
 * List accounts, newest / most urgent first. Admin only.
 *
 * Paginated because the section can hold thousands of students; the admin UI
 * loads further pages on demand instead of transferring the whole directory.
 */
export async function GET(request: Request) {
  const admin = await requireAdminUserId();
  if (!admin) return forbidden("ADMIN_ONLY");

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const status = parseEnum(Object.values(UserStatus), url.searchParams.get("status"));
  const role = parseEnum(Object.values(UserRole), url.searchParams.get("role"));

  const rawPage = Number(url.searchParams.get("page"));
  const rawPageSize = Number(url.searchParams.get("pageSize"));
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.trunc(rawPage) : 1;
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize > 0
      ? Math.min(Math.trunc(rawPageSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  const where: Prisma.UserWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(role ? { role } : {}),
  };

  const [users, total, matching, pending, active, suspended, admins] =
    await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: userInclude,
      }),
      prisma.user.count(),
      prisma.user.count({ where }),
      prisma.user.count({ where: { status: "PENDING" } }),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "SUSPENDED" } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
    ]);

  const payload: AdminUsersResponse = {
    users: users.map(adminUserDTO),
    stats: { total, pending, active, suspended, admins },
    page,
    pageSize,
    total: matching,
    hasMore: page * pageSize < matching,
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** Create an account on someone's behalf, already approved if requested. */
export async function POST(request: Request) {
  const admin = await requireAdminUserId();
  if (!admin) return forbidden("ADMIN_ONLY");

  const parsed = adminCreateUserSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  const { name, email, password, role, status } = parsed.data;

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        status,
        approvedAt: status === "ACTIVE" ? new Date() : null,
        emailVerified: status === "ACTIVE" ? new Date() : null,
      },
      include: userInclude,
    });

    return NextResponse.json({ user: adminUserDTO(user) }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
    }

    console.error("[admin:create-user]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
