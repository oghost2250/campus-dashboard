import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUserId, unauthorized } from "@/lib/api";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, moodleToken: true, moodleUrl: true },
  });

  if (!user) return unauthorized();

  return NextResponse.json({
    email: user.email,
    moodleToken: user.moodleToken ?? null,
    moodleUrl: user.moodleUrl ?? null,
  });
}
