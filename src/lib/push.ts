import "server-only";
import webpush from "web-push";

import { env, isPushConfigured } from "@/lib/env";

if (isPushConfigured) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    env.VAPID_PRIVATE_KEY as string,
  );
}

export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type ClassAlarmPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export function sendClassAlarm(
  subscription: StoredPushSubscription,
  payload: ClassAlarmPayload,
) {
  return webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload),
  );
}

/** HTTP status a push service returns when the subscription is gone for good. */
export function isExpiredSubscription(error: unknown): boolean {
  const statusCode = (error as { statusCode?: number } | null)?.statusCode;
  return statusCode === 404 || statusCode === 410;
}

export { isPushConfigured };
