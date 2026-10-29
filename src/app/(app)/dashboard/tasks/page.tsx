import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { pageMetadata } from "@/lib/metadata";
import { taskDTO } from "@/lib/serialize";
import { TaskBoard } from "@/components/tasks/task-board";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.tasks);
}

export default async function TasksPage() {
  const user = await requireUser();

  const tasks = await prisma.task.findMany({
    where: { userId: user.id },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  return <TaskBoard initialTasks={tasks.map(taskDTO)} />;
}
