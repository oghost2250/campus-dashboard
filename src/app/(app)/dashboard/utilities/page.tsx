import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { DevUtilities } from "@/components/utilities/dev-utilities";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.utilities);
}

export default function UtilitiesPage() {
  return <DevUtilities />;
}
