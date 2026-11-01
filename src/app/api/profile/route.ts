import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  invalid,
  readJson,
  requireUserId,
  unauthorized,
} from "@/lib/api";
import { profileInputSchema } from "@/lib/validations/productivity";

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const body = await readJson(request);
  const parsed = profileInputSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const user = await prisma.user.update({
    where: { id: userId },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      locale: true,
      theme: true,
      timeFormat: true,
      pomodoroSettings: true,
      gpaScale: true,
      isDeveloper: true,
    },
  });

  return NextResponse.json({ user });
}
