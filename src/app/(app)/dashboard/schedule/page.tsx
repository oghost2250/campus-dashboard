import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { WeeklySchedule } from "@/components/schedule/weekly-schedule";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.schedule);
}

export default function SchedulePage() {
  return <WeeklySchedule />;
}
