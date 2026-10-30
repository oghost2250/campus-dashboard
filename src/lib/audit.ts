import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "USER_CREATED"
  | "USER_APPROVED"
  | "USER_REACTIVATED"
  | "USER_SUSPENDED"
  | "USER_DELETED"
  | "ROLE_PROMOTED_ADMIN"
  | "ROLE_PROMOTED_SUPER"
  | "ROLE_DEMOTED"
  | "ACCOUNT_UPDATED";

/**
 * Best-effort audit trail: a logging failure must never roll back the account
 * action that already succeeded, so errors are reported and swallowed.
 */
export async function recordAudit(input: {
  actorId: string;
  targetId: string | null;
  action: AuditAction;
  metadata: Prisma.InputJsonValue;
}) {
  try {
    await prisma.auditLog.create({ data: input });
  } catch (error) {
    console.error("[audit:write]", error);
  }
}
