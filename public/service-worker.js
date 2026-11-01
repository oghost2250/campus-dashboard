/* Push-only service worker. It never intercepts fetches, so authenticated
   pages are always rendered fresh from the server. */

const ICON = "/icons/icon-192.png";
const FALLBACK_URL = "/dashboard/schedule";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const options = {
    body: data.body || "",
    icon: data.icon || ICON,
    badge: data.badge || ICON,
    tag: data.tag || "class-alarm",
    renotify: Boolean(data.tag),
    requireInteraction: true,
    timestamp: Date.now(),
    data: { url: data.url || FALLBACK_URL },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Upcoming Class!", options),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = new URL(
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : FALLBACK_URL,
    self.location.origin,
  ).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windows) {
        if (client.url === target && "focus" in client) return client.focus();
      }

      if (self.clients.openWindow) return self.clients.openWindow(target);
    })(),
  );
});

/* Chrome may rotate endpoints; re-register and hand the new one to the API. */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const applicationServerKey =
        event.oldSubscription && event.oldSubscription.options
          ? event.oldSubscription.options.applicationServerKey
          : null;
      if (!applicationServerKey) return;

      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      const json = subscription.toJSON();

      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: json.keys ? json.keys.p256dh : "",
            auth: json.keys ? json.keys.auth : "",
          },
          userAgent: self.navigator.userAgent,
        }),
      });
    })(),
  );
});
