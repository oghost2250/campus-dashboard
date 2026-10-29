import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { pageMetadata } from "@/lib/metadata";
import { snippetDTO } from "@/lib/serialize";
import { SnippetGrid } from "@/components/snippets/snippet-grid";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.snippets);
}

export default async function SnippetsPage() {
  const user = await requireUser();

  const snippets = await prisma.snippet.findMany({
    where: { userId: user.id },
    orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
  });

  return <SnippetGrid initialSnippets={snippets.map(snippetDTO)} />;
}
