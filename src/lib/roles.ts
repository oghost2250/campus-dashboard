import type { UserRole } from "@prisma/client";

const RANK: Record<UserRole, number> = {
  USER: 0,
  ADMIN: 1,
  SUPER_ADMIN: 2,
};

/** Higher roles inherit every permission of the roles below them. */
export function roleRank(role: UserRole): number {
  return RANK[role] ?? 0;
}

export function hasRole(role: UserRole, minimum: UserRole): boolean {
  return roleRank(role) >= roleRank(minimum);
}

/** An actor may only change accounts strictly below its own rank. */
export function canManageRole(actor: UserRole, target: UserRole): boolean {
  return roleRank(actor) > roleRank(target);
}
