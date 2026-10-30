import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  badRequest,
  invalid,
  readJson,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { studyMaterialCreateSchema } from "@/lib/validations/study-materials";
import type { StudyMaterialDTO } from "@/lib/types";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

function toDTO(row: {
  id: string;
  title: string;
  course: string;
  category: string;
  privacy: string;
  fileData: string;
  fileType: string;
  ownerName: string;
  createdAt: Date;
  userId: string;
}, currentUserId: string): StudyMaterialDTO {
  return {
    id: row.id,
    title: row.title,
    course: row.course,
    category: row.category,
    privacy: row.privacy === "public" ? "public" : "private",
    fileData: row.fileData,
    fileType: row.fileType,
    owner: row.ownerName,
    createdAt: row.createdAt.toISOString(),
    isOwner: row.userId === currentUserId,
  };
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") === "community" ? "community" : "vault";
  const course = url.searchParams.get("course")?.trim() || undefined;

  const where: Prisma.StudyMaterialWhereInput =
    scope === "community"
      ? { privacy: "public", ...(course ? { course } : {}) }
      : { userId, ...(course ? { course } : {}) };

  const rows = await prisma.studyMaterial.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ materials: rows.map((r) => toDTO(r, userId)) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const parsed = studyMaterialCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  const input = parsed.data;
  // Rough size guard on the base64 payload.
  if (input.fileData.length > MAX_FILE_BYTES * 1.4) {
    return badRequest("FILE_TOO_LARGE");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const ownerName = user?.name?.trim() || user?.email || "You";

  const created = await prisma.studyMaterial.create({
    data: {
      title: input.title,
      course: input.course,
      category: input.category,
      privacy: input.privacy,
      fileData: input.fileData,
      fileType: input.fileType,
      ownerName,
      userId,
    },
  });

  return NextResponse.json(
    { material: toDTO({ ...created, userId }, userId) },
    { status: 201 },
  );
}
