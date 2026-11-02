import { NextResponse } from "next/server";
import { env, isPushConfigured } from "@/lib/env";
import { isExpiredSubscription, sendClassAlarm } from "@/lib/push";
import { prisma } from "@/lib/prisma";
import { forEachConcurrent } from "@/lib/concurrency";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request) {
  return Boolean(env.CRON_SECRET) &&
    request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isPushConfigured) {
    return NextResponse.json({ error: "PUSH_NOT_CONFIGURED" }, { status: 503 });
  }

  const now = new Date();
  const reminderWindowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000 + 50 * 60 * 1000);
  const reminderWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 10 * 60 * 1000);
  const claimExpiredBefore = new Date(now.getTime() - 15 * 60 * 1000);
  const assignments = await prisma.assignment.findMany({
    where: {
      cohort: "CS-1",
      isActive: true,
      dueDate: { gte: reminderWindowStart, lte: reminderWindowEnd },
    },
    select: { id: true, title: true, course: true, dueDate: true, createdAt: true },
  });
  const dueForReminder = assignments.filter(
    (assignment) => assignment.createdAt.getTime() <= assignment.dueDate.getTime() - 24 * 60 * 60 * 1000,
  );
  const students = await prisma.user.findMany({
    where: { role: "USER", status: "ACTIVE", pushSubscriptions: { some: {} } },
    select: {
      id: true,
      locale: true,
      pushSubscriptions: {
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      },
    },
  });

  let sent = 0;
  let failed = 0;
  let pruned = 0;
  let skipped = 0;

  for (const assignment of dueForReminder) {
    await forEachConcurrent(students, 25, async (student) => {
      for (const subscription of student.pushSubscriptions) {
        const claim = await prisma.assignmentReminderDelivery.createMany({
          data: [{ assignmentId: assignment.id, subscriptionId: subscription.id }],
          skipDuplicates: true,
        });
        const acquired = claim.count === 1 || (await prisma.assignmentReminderDelivery.updateMany({
          where: {
            assignmentId: assignment.id,
            subscriptionId: subscription.id,
            sentAt: null,
            claimedAt: { lt: claimExpiredBefore },
          },
          data: { claimedAt: now },
        })).count === 1;
        if (!acquired) {
          skipped += 1;
          continue;
        }

        try {
          const due = assignment.dueDate.toLocaleString(student.locale === "ar" ? "ar-EG" : "en", {
            timeZone: env.APP_TIME_ZONE,
            dateStyle: "medium",
            timeStyle: "short",
          });
          await sendClassAlarm(subscription, {
            title: student.locale === "ar" ? "موعد تسليم قريب" : "Assignment due tomorrow",
            body: student.locale === "ar"
              ? `${assignment.title} · ${assignment.course} — موعد التسليم ${due}`
              : `${assignment.title} · ${assignment.course} is due ${due}.`,
            url: "/dashboard/assignments",
            tag: `assignment-${assignment.id}`,
          });
          sent += 1;
          await prisma.assignmentReminderDelivery.updateMany({
            where: { assignmentId: assignment.id, subscriptionId: subscription.id },
            data: { sentAt: new Date() },
          });
        } catch (error) {
          failed += 1;
          if (isExpiredSubscription(error)) {
            await prisma.pushSubscription.delete({ where: { id: subscription.id } })
              .then(() => { pruned += 1; }).catch(() => {});
          }
          await prisma.assignmentReminderDelivery.deleteMany({
            where: { assignmentId: assignment.id, subscriptionId: subscription.id, sentAt: null },
          });
        }
      }
    });
  }

  return NextResponse.json({
    ok: true,
    matchedAssignments: dueForReminder.length,
    sent,
    failed,
    pruned,
    skipped,
  });
}
