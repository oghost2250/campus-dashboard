import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { readJson, requireUserId, unauthorized } from "@/lib/api";
import { z } from "zod";

const connectSchema = z.object({
  moodleUrl: z.string().trim().url().optional().or(z.literal("")),
  moodleToken: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const body = await readJson(request);
  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 422 });
  }

  const moodleUrl = parsed.data.moodleUrl || null;
  const moodleToken = parsed.data.moodleToken || null;

  await prisma.user.update({
    where: { id: userId },
    data: { moodleUrl, moodleToken },
  });

  return NextResponse.json({ ok: true });
}
