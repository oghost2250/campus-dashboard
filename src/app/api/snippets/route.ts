import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  readJson,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { snippetInputSchema } from "@/lib/validations/snippet";
import { snippetDTO } from "@/lib/serialize";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const snippets = await prisma.snippet.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ snippets: snippets.map(snippetDTO) });
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
