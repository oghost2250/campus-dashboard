"use client";

import { useEffect } from "react";
import type { OneSignalClient } from "@/types/onesignal";

export function OneSignalProvider({ userId }: { userId: string }) {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (!appId) return;

    // Remove the old manual Web Push worker so it cannot conflict.
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) =>
          Promise.all(
            regs
              .filter((reg) => reg.active?.scriptURL.endsWith("/service-worker.js"))
              .map((reg) => reg.unregister()),
          ),
        )
        .catch(() => {});
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: OneSignalClient) => {
      await OneSignal.init({
        appId,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: false },
        serviceWorkerPath: "/OneSignalSDKWorker.js",
        serviceWorkerParam: { scope: "/" },
      });
      await OneSignal.login(userId);
    });
  }, [userId]);

  return null;
}
