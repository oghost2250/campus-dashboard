import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  readJson,
  readPagination,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { snippetInputSchema } from "@/lib/validations/snippet";
import { snippetDTO } from "@/lib/serialize";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { limit, offset } = readPagination(request);

  const [snippets, total] = await Promise.all([
    prisma.snippet.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.snippet.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    snippets: snippets.map(snippetDTO),
    total,
    hasMore: offset + snippets.length < total,
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const body = await readJson(request);
  const parsed = snippetInputSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const snippet = await prisma.snippet.create({
    data: {
      ...parsed.data,
      isFavorite: parsed.data.isFavorite ?? false,
      userId,
    },
  });

  return NextResponse.json(
    { snippet: snippetDTO(snippet) },
    { status: 201 },
  );
}
