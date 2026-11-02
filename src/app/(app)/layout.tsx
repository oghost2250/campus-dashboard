import type { ReactNode } from "react";
import Script from "next/script";

// All dashboard pages render per-user data; never serve a cached/shared copy.
export const dynamic = "force-dynamic";

import { AccountSync } from "@/components/layout/account-sync";
import { AppShell } from "@/components/layout/app-shell";
import { OneSignalProvider } from "@/components/notifications/one-signal-provider";
import { requireUser } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  return (
    <AppShell user={user}>
      <Script
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        strategy="afterInteractive"
      />
      <OneSignalProvider userId={user.id} />
      <AccountSync theme={user.theme} locale={user.locale} />
      {children}
    </AppShell>
  );
}
