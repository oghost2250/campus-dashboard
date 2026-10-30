import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { pageMetadata } from "@/lib/metadata";
import { adminUserDTO } from "@/lib/serialize";
import { AdminUsers } from "@/components/admin/admin-users";

const PAGE_SIZE = 100;

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.admin.title);
}

export default async function AdminPage() {
  const user = await requireAdmin();

  const [users, total, pending, active, suspended, admins] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: PAGE_SIZE,
      include: {
        _count: {
          select: { tasks: true, courses: true, snippets: true, notes: true },
        },
      },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
  ]);

  return (
    <AdminUsers
      initialUsers={users.map(adminUserDTO)}
      initialStats={{ total, pending, active, suspended, admins }}
      initialHasMore={users.length < total}
      pageSize={PAGE_SIZE}
      currentUserId={user.id}
    />
  );
}
