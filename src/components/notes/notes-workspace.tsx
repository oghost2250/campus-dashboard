"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Check,
  Eye,
  Loader2,
  NotebookPen,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/i18n/provider";
import { formatDate, wordCount } from "@/lib/format";
import type { NoteDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved";

const markdownProse =
  "text-sm leading-relaxed text-foreground " +
  "[&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:tracking-tight " +
  "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold " +
  "[&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold " +
  "[&_p]:my-2 [&_p]:leading-relaxed " +
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:ps-5 " +
  "[&_li]:my-1 [&_li]:leading-relaxed " +
  "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 " +
  "[&_strong]:font-semibold " +
  "[&_blockquote]:my-3 [&_blockquote]:border-s-2 [&_blockquote]:border-primary/40 [&_blockquote]:ps-3 [&_blockquote]:text-muted-foreground " +
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] " +
  "[&_pre]:my-3 [&_pre]:overflow-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-muted [&_pre]:p-3 " +
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_hr]:my-4 [&_hr]:border-border " +
  "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs " +
  "[&_th]:border [&_th]:border-border/70 [&_th]:bg-muted/60 [&_th]:px-2 [&_th]:py-1 [&_th]:text-start " +
  "[&_td]:border [&_td]:border-border/70 [&_td]:px-2 [&_td]:py-1";

export function NotesWorkspace({ initialNotes }: { initialNotes: NoteDTO[] }) {
  const { t, locale } = useI18n();

  const [notes, setNotes] = useState(initialNotes);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialNotes[0]?.id ?? null,
  );
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NoteDTO | null>(null);

  const saveTimer = useRef<number | null>(null);
  const statusTimer = useRef<number | null>(null);
  const pendingRef = useRef<{
    id: string;
    patch: { title?: string; content?: string; isPinned?: boolean };
  } | null>(null);

  useEffect(() => setNotes(initialNotes), [initialNotes]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (statusTimer.current) window.clearTimeout(statusTimer.current);

      const pending = pendingRef.current;
      if (pending) {
        void fetch(`/api/notes/${pending.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending.patch),
          keepalive: true,
        }).catch(() => undefined);
      }
    };
  }, []);

  const selected = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId],
  );

  function markSaved() {
    setSaveState("saved");
    if (statusTimer.current) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setSaveState("idle"), 1800);
  }

  async function flush() {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;

    try {
      const response = await fetch(`/api/notes/${pending.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending.patch),
      });
      if (!response.ok) throw new Error("request failed");
      markSaved();
    } catch {
      setSaveState("idle");
      toast.error(t.common.error);
    }
  }

  function scheduleSave(patch: { title?: string; content?: string }) {
    const id = selectedId;
    if (!id) return;

    const merged =
      pendingRef.current && pendingRef.current.id === id
        ? { ...pendingRef.current.patch, ...patch }
        : patch;

    pendingRef.current = { id, patch: merged };
    setSaveState("saving");

    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void flush();
    }, 750);
  }

  function updateSelected(patch: { title?: string; content?: string }) {
    if (!selectedId) return;
    setNotes((current) =>
      current.map((note) =>
        note.id === selectedId
          ? { ...note, ...patch, updatedAt: new Date().toISOString() }
          : note,
      ),
    );
    scheduleSave(patch);
  }

  function selectNote(id: string) {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
      void flush();
    }
    setSelectedId(id);
    setTab("write");
  }

  async function createNote() {
    setCreating(true);
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t.notes.untitled }),
      });
      if (!response.ok) throw new Error("request failed");

      const data = (await response.json()) as { note: NoteDTO };
      setNotes((current) => [data.note, ...current]);
      setSelectedId(data.note.id);
      setTab("write");
    } catch {
      toast.error(t.common.error);
    } finally {
      setCreating(false);
    }
  }

  async function togglePin(note: NoteDTO) {
    const next = !note.isPinned;
    const snapshot = notes;

    setNotes((current) => {
      const updated = current.map((item) =>
        item.id === note.id ? { ...item, isPinned: next } : item,
      );
      return updated.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
    });

    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: next }),
      });
      if (!response.ok) throw new Error("request failed");
    } catch {
      setNotes(snapshot);
      toast.error(t.common.error);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);

    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pendingRef.current?.id === target.id) pendingRef.current = null;

    const snapshot = notes;
    const remaining = notes.filter((note) => note.id !== target.id);
    setNotes(remaining);
    if (selectedId === target.id) {
      setSelectedId(remaining[0]?.id ?? null);
    }

    try {
      const response = await fetch(`/api/notes/${target.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("request failed");
      toast.success(t.notes.deleted);
    } catch {
      setNotes(snapshot);
      setSelectedId(target.id);
      toast.error(t.common.error);
    }
  }

  const words = selected ? wordCount(selected.content) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.notes.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.notes.subtitle}</p>
        </div>
        <Button
          className="h-9 rounded-xl"
          onClick={createNote}
          disabled={creating}
        >
          {creating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          {t.notes.new}
        </Button>
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-card/40 px-6 py-20 text-center">
          <div className="grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <NotebookPen className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">{t.notes.empty}</p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={createNote}
            disabled={creating}
          >
            <Plus className="size-3.5" />
            {t.notes.new}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[292px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-sm">
            <ul className="max-h-[260px] divide-y divide-border/60 overflow-y-auto lg:max-h-[calc(100dvh-15rem)]">
              {notes.map((note) => {
                const active = note.id === selectedId;
                return (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => selectNote(note.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "group flex w-full items-start gap-2 px-3.5 py-3 text-start transition-colors",
                        active
                          ? "bg-primary/8"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-1.5 shrink-0 rounded-full transition-colors",
                          active ? "bg-primary" : "bg-transparent",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "truncate text-xs font-medium",
                              active ? "text-foreground" : "text-foreground/85",
                            )}
                          >
                            {note.title || t.notes.untitled}
                          </span>
                          {note.isPinned ? (
                            <Pin className="size-2.5 shrink-0 fill-current text-primary/70" />
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {note.content.trim().slice(0, 48) || t.notes.placeholder}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground/70">
                          {formatDate(note.updatedAt, locale)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="flex min-h-[420px] flex-col rounded-2xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-sm">
            <AnimatePresence mode="wait" initial={false}>
              {selected ? (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                    <Input
                      value={selected.title}
                      onChange={(event) =>
                        updateSelected({ title: event.target.value })
                      }
                      placeholder={t.notes.untitled}
                      aria-label={t.notes.untitled}
                      className="h-9 min-w-0 flex-1 border-none bg-transparent px-1 text-base font-semibold shadow-none focus-visible:ring-0"
                    />

                    <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
                      {saveState === "saving" ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          {t.notes.saving}
                        </>
                      ) : saveState === "saved" ? (
                        <>
                          <Check className="size-3 text-success" />
                          {t.notes.saved}
                        </>
                      ) : null}
                    </span>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg"
                      onClick={() => togglePin(selected)}
                      aria-label={selected.isPinned ? t.notes.unpin : t.notes.pin}
                      aria-pressed={selected.isPinned}
                    >
                      {selected.isPinned ? (
                        <PinOff className="size-3.5" />
                      ) : (
                        <Pin className="size-3.5" />
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(selected)}
                      aria-label={t.common.delete}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between gap-2 px-4 pt-3">
                    <Tabs
                      value={tab}
                      onValueChange={(value) =>
                        setTab(value as "write" | "preview")
                      }
                    >
                      <TabsList className="h-8">
                        <TabsTrigger
                          value="write"
                          className="gap-1.5 text-xs"
                        >
                          <Pencil className="size-3" />
                          {t.notes.write}
                        </TabsTrigger>
                        <TabsTrigger
                          value="preview"
                          className="gap-1.5 text-xs"
                        >
                          <Eye className="size-3" />
                          {t.notes.preview}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {words} {t.notes.words}
                    </span>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col p-4 pt-3">
                    {tab === "write" ? (
                      <Textarea
                        value={selected.content}
                        onChange={(event) =>
                          updateSelected({ content: event.target.value })
                        }
                        placeholder={t.notes.placeholder}
                        spellCheck
                        className="min-h-[320px] flex-1 resize-none rounded-xl border-border/60 bg-background/40 p-4 text-sm leading-relaxed"
                      />
                    ) : (
                      <div className="min-h-[320px] flex-1 overflow-y-auto rounded-xl border border-border/60 bg-background/40 p-5">
                        {selected.content.trim() ? (
                          <div className={markdownProse} dir="auto">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {selected.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {t.notes.placeholder}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        </div>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.notes.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.notes.deleteBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
