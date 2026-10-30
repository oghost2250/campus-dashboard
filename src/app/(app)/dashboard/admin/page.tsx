import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { pageMetadata } from "@/lib/metadata";
import { adminUserDTO, adminUserSelect } from "@/lib/serialize";
import { AdminAudit } from "@/components/admin/admin-audit";
import { AdminUsers } from "@/components/admin/admin-users";

const PAGE_SIZE = 100;
const AUDIT_LIMIT = 8;

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.admin.title);
}

export default async function AdminPage() {
  const user = await requireRole("ADMIN");

  const [users, total, pending, active, suspended, admins, audit] =
    await Promise.all([
      prisma.user.findMany({
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: PAGE_SIZE,
        select: adminUserSelect,
      }),
      prisma.user.count(),
      prisma.user.count({ where: { status: "PENDING" } }),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "SUSPENDED" } }),
      prisma.user.count({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: AUDIT_LIMIT,
        select: {
          id: true,
          action: true,
          metadata: true,
          createdAt: true,
          actor: { select: { name: true, email: true } },
          target: { select: { name: true, email: true } },
        },
      }),
    ]);

  return (
    <div className="space-y-6">
      <AdminUsers
        initialUsers={users.map(adminUserDTO)}
        initialStats={{ total, pending, active, suspended, admins }}
        initialHasMore={users.length < total}
        pageSize={PAGE_SIZE}
        currentUserId={user.id}
        actorRole={user.role}
      />
      <AdminAudit
        entries={audit.map((entry) => ({
          id: entry.id,
          action: entry.action,
          actor: entry.actor?.name ?? entry.actor?.email ?? null,
          target:
            entry.target?.name ??
            entry.target?.email ??
            (entry.metadata as { email?: string } | null)?.email ??
            null,
          createdAt: entry.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
