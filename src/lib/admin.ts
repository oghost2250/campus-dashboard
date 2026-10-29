import type { AdminStatsDTO, AdminUserDTO } from "@/lib/types";

/** Derive the dashboard counters from a full user list. */
export function computeAdminStats(users: AdminUserDTO[]): AdminStatsDTO {
  return users.reduce<AdminStatsDTO>(
    (stats, user) => {
      stats.total += 1;
      if (user.status === "PENDING") stats.pending += 1;
      if (user.status === "ACTIVE") stats.active += 1;
      if (user.status === "SUSPENDED") stats.suspended += 1;
      if (user.role === "ADMIN") stats.admins += 1;
      return stats;
    },
    { total: 0, pending: 0, active: 0, suspended: 0, admins: 0 },
  );
}
