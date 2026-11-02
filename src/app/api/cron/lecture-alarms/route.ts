import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { isExpiredSubscription, isPushConfigured, sendClassAlarm } from "@/lib/push";
import { prisma } from "@/lib/prisma";
import { toMinutes } from "@/lib/time";
import { forEachConcurrent } from "@/lib/concurrency";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** How far a class may be from "exactly one hour away" before it is skipped. */
const WINDOW_MINUTES = 5;

type ZonedTarget = { day: string; date: string; minutes: number };

/** Wall-clock day + minute-of-day for `date` in `timeZone`. */
function zonedTarget(timeZone: string, date: Date): ZonedTarget {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values = new Map(parts.map((part) => [part.type, part.value]));
  const rawHour = values.get("hour") ?? "00";
  const hour = rawHour === "24" ? "00" : rawHour;
  const minute = values.get("minute") ?? "00";

  return {
    day: values.get("weekday") ?? "",
    date: `${values.get("year")}-${values.get("month")}-${values.get("day")}`,
    minutes: Number(hour) * 60 + Number(minute),
  };
}

function isAuthorized(request: Request): boolean {
  if (!env.CRON_SECRET) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!isPushConfigured) {
    return NextResponse.json(
      { error: "PUSH_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const target = zonedTarget(
    env.APP_TIME_ZONE,
    new Date(Date.now() + 60 * 60 * 1000),
  );
  const [year, month, day] = target.date.split("-").map(Number);
  const classDate = new Date(Date.UTC(year, month - 1, day));
  const claimExpiredBefore = new Date(Date.now() - 15 * 60 * 1000);

  const courses = await prisma.scheduleCourse.findMany({
    where: {
      day: target.day,
      user: { pushSubscriptions: { some: {} } },
    },
    select: {
      id: true,
      title: true,
      room: true,
      startTime: true,
      user: {
        select: {
          pushSubscriptions: {
            select: { id: true, endpoint: true, p256dh: true, auth: true },
          },
        },
      },
    },
  });

  const due = courses.filter(
    (course) =>
      Math.abs(toMinutes(course.startTime) - target.minutes) <= WINDOW_MINUTES,
  );

  let sent = 0;
  let failed = 0;
  let pruned = 0;
  let skipped = 0;

  const deliveries = due.flatMap((course) =>
    course.user.pushSubscriptions.map((subscription) => ({ course, subscription })),
  );

  await forEachConcurrent(deliveries, 25, async ({ course, subscription }) => {
    const claim = await prisma.classReminderDelivery.createMany({
      data: [{
        scheduleCourseId: course.id,
        subscriptionId: subscription.id,
        classDate,
      }],
      skipDuplicates: true,
    });
    const acquired = claim.count === 1 || (await prisma.classReminderDelivery.updateMany({
      where: {
        scheduleCourseId: course.id,
        subscriptionId: subscription.id,
        classDate,
        sentAt: null,
        claimedAt: { lt: claimExpiredBefore },
      },
      data: { claimedAt: new Date() },
    })).count === 1;
    if (!acquired) {
      skipped += 1;
      return;
    }

    const location = course.room?.trim();
    const payload = {
      title: "Upcoming Class!",
      body: `${course.title} starts in 1 hour${location ? ` at ${location}` : ""}.`,
      url: "/dashboard/schedule",
      tag: `class-${course.id}`,
    };

    try {
      await sendClassAlarm(subscription, payload);
      sent += 1;
      await prisma.classReminderDelivery.updateMany({
        where: {
          scheduleCourseId: course.id,
          subscriptionId: subscription.id,
          classDate,
        },
        data: { sentAt: new Date() },
      });
    } catch (error) {
      failed += 1;
      if (isExpiredSubscription(error)) {
        await prisma.pushSubscription
          .delete({ where: { id: subscription.id } })
          .then(() => {
            pruned += 1;
          })
          .catch(() => {});
      }
      await prisma.classReminderDelivery.deleteMany({
        where: {
          scheduleCourseId: course.id,
          subscriptionId: subscription.id,
          classDate,
          sentAt: null,
        },
      });
      await prisma.classReminderDelivery.deleteMany({
        where: {
          scheduleCourseId: course.id,
          subscriptionId: subscription.id,
          classDate,
        },
      });
    }
  });

  return NextResponse.json({
    ok: true,
    day: target.day,
    targetTime: `${String(Math.floor(target.minutes / 60)).padStart(2, "0")}:${String(target.minutes % 60).padStart(2, "0")}`,
    matchedCourses: due.length,
    sent,
    failed,
    pruned,
    skipped,
  });
}
