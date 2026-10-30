import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  parseDate,
  readJson,
  readPagination,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { projectInputSchema } from "@/lib/validations/project";
import { projectDTO } from "@/lib/serialize";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { limit, offset } = readPagination(request);

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where: { userId },
      orderBy: [{ status: "asc" }, { completedAt: "desc" }, { updatedAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.project.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    projects: projects.map(projectDTO),
    total,
    hasMore: offset + projects.length < total,
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const body = await readJson(request);
  const parsed = projectInputSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const { completedAt, ...rest } = parsed.data;

  const project = await prisma.project.create({
    data: {
      ...rest,
      completedAt: parseDate(completedAt),
      featured: rest.featured ?? false,
      userId,
    },
  });

  return NextResponse.json(
    { project: projectDTO(project) },
    { status: 201 },
  );
}
