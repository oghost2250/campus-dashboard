const globalForCron = globalThis as unknown as { __alarmCronStarted?: boolean };

/**
 * Dev-only scheduler: hits the alarm cron every minute so push notifications
 * fire automatically while testing locally. Vercel Cron handles production.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV === "production") return;
  if (globalForCron.__alarmCronStarted) return;
  globalForCron.__alarmCronStarted = true;

  const secret = process.env.CRON_SECRET;
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const tick = async () => {
    try {
      await fetch(`${base}/api/cron/lecture-alarms`, {
        headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
        cache: "no-store",
      });
    } catch {
      /* server not ready yet; retry on the next tick */
    }
  };

  setTimeout(() => {
    void tick();
  }, 10_000);
  setInterval(() => {
    void tick();
  }, 60_000);
}
