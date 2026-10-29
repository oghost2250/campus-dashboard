import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { pageMetadata } from "@/lib/metadata";
import { noteDTO } from "@/lib/serialize";
import { NotesWorkspace } from "@/components/notes/notes-workspace";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata((t) => t.nav.notes);
}

export default async function NotesPage() {
  const user = await requireUser();

  const notes = await prisma.note.findMany({
    where: { userId: user.id },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  });

  return <NotesWorkspace initialNotes={notes.map(noteDTO)} />;
}
