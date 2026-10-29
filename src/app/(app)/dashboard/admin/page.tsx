import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { pageMetadata } from "@/lib/metadata";
import { adminUserDTO } from "@/lib/serialize";
import { AdminUsers } from "@/components/admin/admin-users";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.admin.title);
}

export default async function AdminPage() {
  const user = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: { tasks: true, courses: true, snippets: true, notes: true },
      },
    },
  });

  return (
    <AdminUsers
      initialUsers={users.map(adminUserDTO)}
      currentUserId={user.id}
    />
  );
}
