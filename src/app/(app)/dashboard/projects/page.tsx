import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { pageMetadata } from "@/lib/metadata";
import { projectDTO } from "@/lib/serialize";
import { ProjectShowcase } from "@/components/projects/project-showcase";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.projects);
}

export default async function ProjectsPage() {
  const user = await requireUser();

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
  });

  return <ProjectShowcase initialProjects={projects.map(projectDTO)} />;
}
