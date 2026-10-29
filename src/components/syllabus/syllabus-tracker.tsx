"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpenCheck,
  Check,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n/provider";
import type { SyllabusTopicDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

function percentOf(done: number, total: number) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export function SyllabusTracker({
  initialTopics,
}: {
  initialTopics: SyllabusTopicDTO[];
}) {
  const { t } = useI18n();

  const [topics, setTopics] = useState(initialTopics);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ course: "", title: "" });
  const [saving, setSaving] = useState(false);
  const [quickAdd, setQuickAdd] = useState<Record<string, string>>({});

  const groups = useMemo(() => {
    const map = new Map<string, SyllabusTopicDTO[]>();
    for (const topic of topics) {
      const list = map.get(topic.course) ?? [];
      list.push(topic);
      map.set(topic.course, list);
    }

    return [...map.entries()]
      .map(([course, items]) => {
        const done = items.filter((item) => item.isDone).length;
        return {
          course,
          items,
          done,
          total: items.length,
          percent: percentOf(done, items.length),
        };
      })
      .sort((a, b) => a.course.localeCompare(b.course));
  }, [topics]);

  const total = topics.length;
  const done = topics.filter((topic) => topic.isDone).length;
  const overall = percentOf(done, total);
  const courseNames = groups.map((group) => group.course);

  async function createTopic(course: string, title: string) {
    const cleanCourse = course.trim();
    const cleanTitle = title.trim();
    if (!cleanCourse || !cleanTitle) return false;

    try {
      const response = await fetch("/api/syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course: cleanCourse, title: cleanTitle }),
      });
      if (!response.ok) throw new Error("request failed");

      const data = (await response.json()) as { topic: SyllabusTopicDTO };
      setTopics((current) => [...current, data.topic]);
      toast.success(t.syllabus.added);
      return true;
    } catch {
      toast.error(t.common.error);
      return false;
    }
  }

  async function submitDialog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const ok = await createTopic(form.course, form.title);
    setSaving(false);
    if (ok) {
      setForm({ course: form.course, title: "" });
      setDialogOpen(false);
    }
  }

  async function submitQuickAdd(course: string) {
    const title = quickAdd[course] ?? "";
    const ok = await createTopic(course, title);
    if (ok) setQuickAdd((current) => ({ ...current, [course]: "" }));
  }

  async function toggleTopic(topic: SyllabusTopicDTO) {
    const next = !topic.isDone;
    const snapshot = topics;
    setTopics((current) =>
      current.map((item) =>
        item.id === topic.id ? { ...item, isDone: next } : item,
      ),
    );

    try {
      const response = await fetch(`/api/syllabus/${topic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDone: next }),
      });
      if (!response.ok) throw new Error("request failed");
    } catch {
      setTopics(snapshot);
      toast.error(t.common.error);
    }
  }

  async function deleteTopic(topic: SyllabusTopicDTO) {
    const snapshot = topics;
    setTopics((current) => current.filter((item) => item.id !== topic.id));

    try {
      const response = await fetch(`/api/syllabus/${topic.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("request failed");
      toast.success(t.syllabus.deleted);
    } catch {
      setTopics(snapshot);
      toast.error(t.common.error);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.syllabus.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.syllabus.subtitle}</p>
        </div>
        <Button
          className="h-9 rounded-xl"
          onClick={() => {
            setForm({ course: courseNames[0] ?? "", title: "" });
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          {t.syllabus.new}
        </Button>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-sm sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(32rem 16rem at 10% -20%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%)",
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <BookOpenCheck className="size-3.5 text-primary" />
              {t.syllabus.overall}
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tabular-nums">
                {overall}%
              </span>
              <span className="text-sm text-muted-foreground">
                {t.syllabus.topicsDone
                  .replace("{done}", String(done))
                  .replace("{total}", String(total))}
              </span>
            </p>
          </div>
          <div className="text-end text-xs text-muted-foreground">
            <p>
              {groups.length} {t.syllabus.courses}
            </p>
            <p className="mt-1">
              {total - done} {t.syllabus.remaining}
            </p>
          </div>
        </div>

        <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-chart-3"
            initial={false}
            animate={{ width: `${overall}%` }}
            transition={{ type: "spring", stiffness: 160, damping: 26 }}
          />
        </div>
      </section>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-card/40 px-6 py-16 text-center">
          <div className="grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <BookOpenCheck className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">{t.syllabus.empty}</p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-3.5" />
            {t.syllabus.addFirst}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {groups.map((group) => (
              <motion.section
                key={group.course}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col rounded-2xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold tracking-tight">
                      {group.course}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {group.done} / {group.total} {t.syllabus.completed}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
                      group.percent === 100
                        ? "bg-success/12 text-success"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {group.percent}%
                  </span>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-300",
                      group.percent === 100 ? "bg-success" : "bg-primary",
                    )}
                    style={{ width: `${group.percent}%` }}
                  />
                </div>

                <ul className="mt-3 space-y-0.5">
                  <AnimatePresence initial={false}>
                    {group.items.map((topic) => (
                      <motion.li
                        key={topic.id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={topic.isDone}
                          onCheckedChange={() => toggleTopic(topic)}
                          aria-label={topic.title}
                        />
                        <span
                          className={cn(
                            "min-w-0 flex-1 text-[13px] leading-snug",
                            topic.isDone &&
                              "text-muted-foreground line-through decoration-muted-foreground/50",
                          )}
                        >
                          {topic.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteTopic(topic)}
                          aria-label={t.common.delete}
                          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground/50 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>

                <form
                  className="mt-3 flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitQuickAdd(group.course);
                  }}
                >
                  <Input
                    value={quickAdd[group.course] ?? ""}
                    onChange={(event) =>
                      setQuickAdd((current) => ({
                        ...current,
                        [group.course]: event.target.value,
                      }))
                    }
                    placeholder={t.syllabus.quickAdd}
                    aria-label={t.syllabus.quickAdd}
                    className="h-8 rounded-lg text-xs"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    variant="outline"
                    className="size-8 shrink-0 rounded-lg"
                    aria-label={t.syllabus.addTopic}
                    disabled={!(quickAdd[group.course] ?? "").trim()}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </form>
              </motion.section>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.syllabus.createTitle}</DialogTitle>
            <DialogDescription>{t.syllabus.subtitle}</DialogDescription>
          </DialogHeader>

          <form onSubmit={submitDialog} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="syllabus-course">{t.syllabus.course}</Label>
              <Input
                id="syllabus-course"
                list="syllabus-course-options"
                value={form.course}
                onChange={(event) =>
                  setForm((state) => ({ ...state, course: event.target.value }))
                }
                placeholder={t.syllabus.coursePlaceholder}
                required
                autoFocus
                className="h-10 rounded-xl"
              />
              <datalist id="syllabus-course-options">
                {courseNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="syllabus-topic">{t.syllabus.topic}</Label>
              <Input
                id="syllabus-topic"
                value={form.title}
                onChange={(event) =>
                  setForm((state) => ({ ...state, title: event.target.value }))
                }
                placeholder={t.syllabus.topicPlaceholder}
                required
                className="h-10 rounded-xl"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                onClick={() => setDialogOpen(false)}
              >
                {t.common.cancel}
              </Button>
              <Button
                type="submit"
                disabled={saving || !form.course.trim() || !form.title.trim()}
                className="rounded-xl"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {t.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
