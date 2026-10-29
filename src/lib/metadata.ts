import "server-only";
import type { Metadata } from "next";

import { dictionaries, type Dictionary } from "@/i18n";
import { getLocale } from "@/lib/session";

/**
 * Page titles follow the active locale. The locale lives in a cookie, so these
 * run as `generateMetadata` instead of a static export — the tab title flips
 * with the language toggle on the next navigation.
 *
 * The root layout's `%s · Campus` template fills in the app name.
 */
export async function pageMetadata(
  select: (t: Dictionary) => string,
): Promise<Metadata> {
  const locale = await getLocale();
  return { title: select(dictionaries[locale]) };
}
