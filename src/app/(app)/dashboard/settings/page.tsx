import type { Metadata } from "next";

import { requireUser } from "@/lib/session";
import { pageMetadata } from "@/lib/metadata";
import { SettingsView } from "@/components/settings/settings-view";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.common.settings);
}

export default async function SettingsPage() {
  const user = await requireUser();

  return <SettingsView user={user} />;
}
