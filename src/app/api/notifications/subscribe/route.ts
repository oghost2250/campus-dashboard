import { NextResponse } from "next/server";

import { invalid, readJson, requireUserId, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { pushSubscriptionSchema } from "@/lib/validations/notifications";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const parsed = pushSubscriptionSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  const { endpoint, keys, userAgent } = parsed.data;

  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
    },
    create: {
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
    },
    select: { id: true },
  });

  return NextResponse.json({ subscribed: true, id: subscription.id });
}

export async function DELETE(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const queryEndpoint = new URL(request.url).searchParams.get("endpoint");
  let endpoint = queryEndpoint;

  if (!endpoint) {
    const body = (await readJson(request)) as { endpoint?: unknown } | null;
    if (typeof body?.endpoint === "string") endpoint = body.endpoint;
  }

  const removed = endpoint
    ? await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } })
    : await prisma.pushSubscription.deleteMany({ where: { userId } });

  return NextResponse.json({ removed: removed.count });
}
