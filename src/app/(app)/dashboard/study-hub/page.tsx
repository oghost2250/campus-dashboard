import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { requireUser } from "@/lib/session";
import { StudyHub } from "@/components/study-hub/study-hub";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.studyHub);
}

export default async function StudyHubPage() {
  const user = await requireUser();
  return <StudyHub userId={user.id} />;
}
