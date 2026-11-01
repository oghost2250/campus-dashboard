"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";

const SERVICE_WORKER_URL = "/service-worker.js";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

async function saveSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!p256dh || !auth) {
    throw new Error("This browser did not return usable push keys.");
  }

  const response = await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: { p256dh, auth },
      userAgent: navigator.userAgent.slice(0, 255),
    }),
  });

  if (!response.ok) {
    throw new Error("Could not save the alarm on your account.");
  }
}

async function removeSubscription(endpoint?: string) {
  const url = endpoint
    ? `/api/notifications/subscribe?endpoint=${encodeURIComponent(endpoint)}`
    : "/api/notifications/subscribe";
  await fetch(url, { method: "DELETE" }).catch(() => {});
}

export function ClassAlarmsToggle({ publicKey }: { publicKey: string | null }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      return;
    }

    setSupported(true);

    let active = true;
    void (async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription || !active) return;
        setSubscribed(true);
        // Re-sync quietly: the row may have been pruned server-side.
        await saveSubscription(subscription).catch(() => {});
      } catch {
        /* a missing/blocked registration simply means alarms are off */
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    if (pending) return;
    if (!publicKey) {
      toast.error("Class alarms are not configured on this server.");
      return;
    }
    if (Notification.permission === "denied") {
      toast.error("Notifications are blocked for this site in your browser.");
      return;
    }

    setPending(true);
    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission was not granted.");
        return;
      }

      const registration = await navigator.serviceWorker.register(
        SERVICE_WORKER_URL,
        { scope: "/" },
      );
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      await saveSubscription(subscription);
      setSubscribed(true);
      toast.success("Class alarms enabled on this device.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not enable class alarms.",
      );
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    if (pending) return;
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      await removeSubscription(subscription?.endpoint);
      await subscription?.unsubscribe();
      setSubscribed(false);
      toast.success("Class alarms disabled on this device.");
    } catch {
      toast.error("Could not disable class alarms.");
    } finally {
      setPending(false);
    }
  }

  const disabled = pending || !supported;

  return (
    <button
      type="button"
      onClick={subscribed ? disable : enable}
      disabled={disabled}
      aria-pressed={subscribed}
      title={
        supported
          ? subscribed
            ? "Disable class alarms on this device"
            : "Get a notification one hour before each class"
          : "Push notifications are not supported in this browser"
      }
      className={[
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
        subscribed
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
          : "border-zinc-700 bg-zinc-800 text-gray-200 hover:bg-zinc-700",
        disabled ? "cursor-not-allowed opacity-60" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : subscribed ? (
        <BellRing className="size-3.5" />
      ) : (
        <Bell className="size-3.5" />
      )}
      {subscribed ? "Class alarms on" : "Enable class alarms"}
    </button>
  );
}
