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
import { computeAdminStats } from "@/lib/admin";
import { adminUserDTO } from "@/lib/serialize";
import { adminCreateUserSchema } from "@/lib/validations/admin";
import type { AdminUsersResponse } from "@/lib/types";

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

/** List accounts, newest / most urgent first. Admin only. */
export async function GET(request: Request) {
  const admin = await requireAdminUserId();
  if (!admin) return forbidden("ADMIN_ONLY");

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const status = parseEnum(Object.values(UserStatus), url.searchParams.get("status"));
  const role = parseEnum(Object.values(UserRole), url.searchParams.get("role"));

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

  const [users, total, pending, active, suspended, admins] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 500,
      include: userInclude,
    }),
    prisma.user.count(),
    prisma.user.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
  ]);

  const payload: AdminUsersResponse = {
    users: users.map(adminUserDTO),
    stats: { total, pending, active, suspended, admins },
  };

  return NextResponse.json(payload);
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

    const users = await prisma.user.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 500,
      include: userInclude,
    });

    return NextResponse.json(
      { user: adminUserDTO(user), stats: computeAdminStats(users.map(adminUserDTO)) },
      { status: 201 },
    );
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
