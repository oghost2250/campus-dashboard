import type { ReactNode } from "react";

import { AccountSync } from "@/components/layout/account-sync";
import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  return (
    <AppShell user={user}>
      <AccountSync theme={user.theme} locale={user.locale} />
      {children}
    </AppShell>
  );
}
