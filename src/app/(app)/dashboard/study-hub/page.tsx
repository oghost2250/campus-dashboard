import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { StudyHub } from "@/components/study-hub/study-hub";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.studyHub);
}

export default function StudyHubPage() {
  return <StudyHub />;
}
