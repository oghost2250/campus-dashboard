import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { pageMetadata } from "@/lib/metadata";
import { PendingView } from "@/components/auth/pending-view";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.pending.title);
}

export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.status === "ACTIVE") redirect("/dashboard");

  const { state } = await searchParams;

  return (
    <PendingView
      user={{ name: user.name, email: user.email }}
      suspended={user.status === "SUSPENDED" || state === "suspended"}
    />
  );
}
