import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  forbidden,
  invalid,
  notFound,
  readJson,
  requireAdminUserId,
} from "@/lib/api";
import { adminUserDTO } from "@/lib/serialize";
import { adminUpdateUserSchema } from "@/lib/validations/admin";

type RouteContext = { params: Promise<{ id: string }> };

const userInclude = {
  _count: {
    select: { tasks: true, courses: true, snippets: true, notes: true },
  },
} as const;

async function otherActiveAdmins(targetId: string) {
  return prisma.user.count({
    where: { id: { not: targetId }, role: "ADMIN", status: "ACTIVE" },
  });
}

/**
 * Approve, suspend, reactivate, promote or demote an account.
 *
 * Guard rails: admins cannot demote or suspend themselves, and the last active
 * admin can never be removed from that role.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const admin = await requireAdminUserId();
  if (!admin) return forbidden("ADMIN_ONLY");

  const { id } = await params;
  const parsed = adminUpdateUserSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, status: true, approvedAt: true },
  });
  if (!target) return notFound();

  const nextRole = parsed.data.role ?? target.role;
  const nextStatus = parsed.data.status ?? target.status;

  if (target.id === admin.id) {
    if (parsed.data.role && parsed.data.role !== "ADMIN") {
      return forbidden("SELF_ROLE");
    }
    if (parsed.data.status && parsed.data.status !== "ACTIVE") {
      return forbidden("SELF_STATUS");
    }
  }

  const losesAdmin =
    target.role === "ADMIN" &&
    target.status === "ACTIVE" &&
    (nextRole !== "ADMIN" || nextStatus !== "ACTIVE");

  if (losesAdmin && (await otherActiveAdmins(target.id)) === 0) {
    return forbidden("LAST_ADMIN");
  }

  const data: Prisma.UserUpdateInput = {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
  };

  if (parsed.data.status === "ACTIVE") {
    data.approvedAt = target.approvedAt ?? new Date();
  } else if (parsed.data.status === "PENDING") {
    data.approvedAt = null;
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      include: userInclude,
    });

    return NextResponse.json({ user: adminUserDTO(user) });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return notFound();
    }

    console.error("[admin:update-user]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

/** Delete an account and every row it owns (cascade). Admin only. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const admin = await requireAdminUserId();
  if (!admin) return forbidden("ADMIN_ONLY");

  const { id } = await params;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, status: true },
  });
  if (!target) return notFound();

  if (target.id === admin.id) return forbidden("SELF_DELETE");

  if (
    target.role === "ADMIN" &&
    target.status === "ACTIVE" &&
    (await otherActiveAdmins(target.id)) === 0
  ) {
    return forbidden("LAST_ADMIN");
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return notFound();
    }

    console.error("[admin:delete-user]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
