import { NextResponse } from "next/server";
import { Prisma, type UserRole, type UserStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  forbidden,
  invalid,
  invalidateUserStatus,
  notFound,
  readJson,
  requireAdminUserId,
} from "@/lib/api";
import { recordAudit, type AuditAction } from "@/lib/audit";
import { canManageRole, hasRole } from "@/lib/roles";
import { adminUserDTO, adminUserSelect } from "@/lib/serialize";
import { adminUpdateUserSchema } from "@/lib/validations/admin";

type RouteContext = { params: Promise<{ id: string }> };

async function otherActiveAdmins(targetId: string) {
  return prisma.user.count({
    where: {
      id: { not: targetId },
      role: { in: ["ADMIN", "SUPER_ADMIN"] },
      status: "ACTIVE",
    },
  });
}

async function otherActiveSuperAdmins(targetId: string) {
  return prisma.user.count({
    where: {
      id: { not: targetId },
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });
}

function auditAction(
  targetRole: UserRole,
  targetStatus: UserStatus,
  nextRole: UserRole,
  nextStatus: UserStatus,
): AuditAction {
  if (nextRole !== targetRole) {
    if (nextRole === "SUPER_ADMIN") return "ROLE_PROMOTED_SUPER";
    if (nextRole === "ADMIN") return "ROLE_PROMOTED_ADMIN";
    return "ROLE_DEMOTED";
  }

  if (nextStatus !== targetStatus) {
    if (nextStatus === "SUSPENDED") return "USER_SUSPENDED";
    if (nextStatus === "ACTIVE") {
      return targetStatus === "PENDING" ? "USER_APPROVED" : "USER_REACTIVATED";
    }
  }

  return "ACCOUNT_UPDATED";
}

/**
 * Approve, suspend, reactivate, promote or demote an account.
 *
 * Guard rails: admins manage students, super admins manage admins, nobody can
 * change their own access, and the last active admin / super admin stays.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const admin = await requireAdminUserId();
  if (!admin) return forbidden("ADMIN_ONLY");

  const { id } = await params;
  const parsed = adminUpdateUserSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      role: true,
      status: true,
      approvedAt: true,
    },
  });
  if (!target) return notFound();

  if (target.id !== admin.id && !canManageRole(admin.role, target.role)) {
    return forbidden("PROTECTED_ACCOUNT");
  }

  const nextRole = parsed.data.role ?? target.role;
  const nextStatus = parsed.data.status ?? target.status;

  if (target.id === admin.id) {
    if (parsed.data.role && parsed.data.role !== target.role) {
      return forbidden("SELF_ROLE");
    }
    if (parsed.data.status && parsed.data.status !== target.status) {
      return forbidden("SELF_STATUS");
    }
  }

  if (nextRole !== target.role) {
    if (!hasRole(admin.role, "SUPER_ADMIN")) {
      return forbidden("SUPER_ADMIN_ONLY");
    }
    if (nextRole === "SUPER_ADMIN" && !target.emailVerified) {
      return forbidden("EMAIL_UNVERIFIED");
    }
  }

  const losesAdmin =
    hasRole(target.role, "ADMIN") &&
    target.status === "ACTIVE" &&
    (!hasRole(nextRole, "ADMIN") || nextStatus !== "ACTIVE");

  if (losesAdmin && (await otherActiveAdmins(target.id)) === 0) {
    return forbidden("LAST_ADMIN");
  }

  const losesSuper =
    target.role === "SUPER_ADMIN" &&
    target.status === "ACTIVE" &&
    (nextRole !== "SUPER_ADMIN" || nextStatus !== "ACTIVE");

  if (losesSuper && (await otherActiveSuperAdmins(target.id)) === 0) {
    return forbidden("LAST_SUPER_ADMIN");
  }

  const data: Prisma.UserUpdateInput = {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
  };

  if (parsed.data.status === "ACTIVE") {
    data.approvedAt = target.approvedAt ?? new Date();
    data.emailVerified = target.emailVerified ?? new Date();
  } else if (parsed.data.status === "PENDING") {
    data.approvedAt = null;
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: adminUserSelect,
    });

    invalidateUserStatus(id);

    await recordAudit({
      actorId: admin.id,
      targetId: id,
      action: auditAction(target.role, target.status, nextRole, nextStatus),
      metadata: {
        email: target.email,
        before: { role: target.role, status: target.status },
        after: { role: nextRole, status: nextStatus },
      },
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
    select: { id: true, email: true, role: true, status: true },
  });
  if (!target) return notFound();

  if (target.id === admin.id) return forbidden("SELF_DELETE");

  if (!canManageRole(admin.role, target.role)) {
    return forbidden("PROTECTED_ACCOUNT");
  }

  const losesAdmin =
    hasRole(target.role, "ADMIN") && target.status === "ACTIVE";

  if (losesAdmin && (await otherActiveAdmins(target.id)) === 0) {
    return forbidden("LAST_ADMIN");
  }

  if (
    target.role === "SUPER_ADMIN" &&
    target.status === "ACTIVE" &&
    (await otherActiveSuperAdmins(target.id)) === 0
  ) {
    return forbidden("LAST_SUPER_ADMIN");
  }

  try {
    await prisma.user.delete({ where: { id } });
    invalidateUserStatus(id);

    await recordAudit({
      actorId: admin.id,
      targetId: null,
      action: "USER_DELETED",
      metadata: {
        email: target.email,
        role: target.role,
        status: target.status,
      },
    });

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
