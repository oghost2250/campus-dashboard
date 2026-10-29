"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";
import { daysUntil, formatDate, toDateInputValue } from "@/lib/format";
import type { TaskDTO } from "@/lib/types";
import type { TaskPriority, TaskStatus } from "@prisma/client";

type Filter = "all" | "today" | "week" | "overdue";

type FormState = {
  title: string;
  subject: string;
  description: string;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
};

const emptyForm: FormState = {
  title: "",
  subject: "",
  description: "",
  dueDate: "",
  status: "TODO",
  priority: "MEDIUM",
};

function sortTasks(tasks: TaskDTO[]) {
  return [...tasks].sort((a, b) => {
    if (a.status === "DONE" && b.status !== "DONE") return 1;
    if (b.status === "DONE" && a.status !== "DONE") return -1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function TaskBoard({ initialTasks }: { initialTasks: TaskDTO[] }) {
  const { t, locale } = useI18n();

  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaskDTO | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskDTO | null>(null);

  useEffect(() => setTasks(initialTasks), [initialTasks]);

  const statusLabel: Record<TaskStatus, string> = {
    TODO: t.tasks.statusTodo,
    IN_PROGRESS: t.tasks.statusInProgress,
    DONE: t.tasks.statusDone,
  };

  const priorityLabel: Record<TaskPriority, string> = {
    LOW: t.tasks.priorityLow,
    MEDIUM: t.tasks.priorityMedium,
    HIGH: t.tasks.priorityHigh,
  };

  const filtered = useMemo(() => {
    const now = new Date();
    const weekAhead = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 7,
    );

    return sortTasks(
      tasks.filter((task) => {
        if (query.trim()) {
          const haystack = `${task.title} ${task.subject}`.toLowerCase();
          if (!haystack.includes(query.trim().toLowerCase())) return false;
        }

        if (filter === "all") return true;
        if (!task.dueDate) return false;

        const due = new Date(task.dueDate);
        const days = daysUntil(due);

        if (filter === "today") return days === 0;
        if (filter === "week") return due >= now && due <= weekAhead;
        return days < 0 && task.status !== "DONE";
      }),
    );
  }, [tasks, filter, query]);

  const openCount = tasks.filter((task) => task.status !== "DONE").length;
  const doneCount = tasks.length - openCount;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(task: TaskDTO) {
    setEditing(task);
    setForm({
      title: task.title,
      subject: task.subject === "General" ? "" : task.subject,
      description: task.description ?? "",
      dueDate: toDateInputValue(task.dueDate),
      status: task.status,
      priority: task.priority,
    });
    setDialogOpen(true);
  }

  async function saveTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      subject: form.subject.trim() || "General",
      description: form.description.trim() || null,
      dueDate: form.dueDate || null,
      status: form.status,
      priority: form.priority,
    };

    try {
      const response = await fetch(
        editing ? `/api/tasks/${editing.id}` : "/api/tasks",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) throw new Error("request failed");

      const data = (await response.json()) as { task: TaskDTO };
      setTasks((current) =>
        editing
          ? current.map((item) => (item.id === data.task.id ? data.task : item))
          : [data.task, ...current],
      );

      toast.success(editing ? t.tasks.updated : t.tasks.created);
      setDialogOpen(false);
    } catch {
      toast.error(t.common.error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(task: TaskDTO) {
    const nextStatus: TaskStatus = task.status === "DONE" ? "TODO" : "DONE";
    const snapshot = tasks;

    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: nextStatus,
              completedAt:
                nextStatus === "DONE" ? new Date().toISOString() : null,
            }
          : item,
      ),
    );

    setPendingId(task.id);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) throw new Error("request failed");

      toast.success(
        nextStatus === "DONE" ? t.tasks.completedToast : t.tasks.reopenedToast,
      );
    } catch {
      setTasks(snapshot);
      toast.error(t.common.error);
    } finally {
      setPendingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    const snapshot = tasks;

    setTasks((current) => current.filter((item) => item.id !== target.id));

    try {
      const response = await fetch(`/api/tasks/${target.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("request failed");
      toast.success(t.tasks.deleted);
    } catch {
      setTasks(snapshot);
      toast.error(t.common.error);
    }
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: t.tasks.filterAll },
    { id: "today", label: t.tasks.filterToday },
    { id: "week", label: t.tasks.filterWeek },
    { id: "overdue", label: t.tasks.filterOverdue },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.tasks.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.tasks.subtitle}</p>
        </div>
        <Button className="h-9 rounded-xl" onClick={openCreate}>
          <Plus className="size-4" />
          {t.tasks.new}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-card/60 p-1">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                filter === item.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {filter === item.id ? (
                <motion.span
                  layoutId="task-filter-pill"
                  className="absolute inset-0 rounded-lg bg-background shadow-sm ring-1 ring-border/70"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span className="relative">{item.label}</span>
            </button>
          ))}
        </div>

        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.common.search}
          className="h-9 w-full rounded-xl sm:w-56"
        />

        <p className="ms-auto text-xs text-muted-foreground">
          {openCount} · {doneCount} {t.tasks.statusDone}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <CalendarDays className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              {tasks.length === 0 ? t.tasks.empty : t.tasks.emptyFiltered}
            </p>
            {tasks.length === 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={openCreate}
              >
                <Plus className="size-3.5" />
                {t.tasks.addFirst}
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            <AnimatePresence initial={false}>
              {filtered.map((task) => {
                const done = task.status === "DONE";
                const days = task.dueDate ? daysUntil(task.dueDate) : null;
                const overdue = days !== null && days < 0 && !done;

                return (
                  <motion.li
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="pt-0.5">
                      <Checkbox
                        checked={done}
                        disabled={pendingId === task.id}
                        onCheckedChange={() => toggleTask(task)}
                        aria-label={
                          done ? t.tasks.markIncomplete : t.tasks.markComplete
                        }
                        className="size-[18px] rounded-full"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={cn(
                            "truncate text-sm font-medium transition-colors",
                            done && "text-muted-foreground line-through",
                          )}
                        >
                          {task.title}
                        </p>
                        {task.status === "IN_PROGRESS" ? (
                          <Badge
                            variant="secondary"
                            className="rounded-md text-[10px] font-normal"
                          >
                            {statusLabel.IN_PROGRESS}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              task.priority === "HIGH"
                                ? "bg-destructive"
                                : task.priority === "MEDIUM"
                                  ? "bg-warning"
                                  : "bg-muted-foreground/50",
                            )}
                          />
                          {priorityLabel[task.priority]}
                        </span>
                        <span className="truncate">{task.subject}</span>
                        {task.dueDate ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              overdue && "font-medium text-destructive",
                            )}
                          >
                            <CalendarDays className="size-3.5" />
                            {formatDate(task.dueDate, locale)}
                          </span>
                        ) : null}
                      </div>

                      {task.description ? (
                        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground/80">
                          {task.description}
                        </p>
                      ) : null}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 rounded-lg opacity-60 transition-opacity group-hover:opacity-100"
                          aria-label={t.common.actions}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => openEdit(task)}
                          className="cursor-pointer"
                        >
                          <Pencil className="size-4" />
                          {t.common.edit}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          className="cursor-pointer"
                          onClick={() => setDeleteTarget(task)}
                        >
                          <Trash2 className="size-4" />
                          {t.common.delete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? t.tasks.editTitle : t.tasks.createTitle}
            </DialogTitle>
            <DialogDescription>{t.tasks.subtitle}</DialogDescription>
          </DialogHeader>

          <form onSubmit={saveTask} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">{t.tasks.taskTitle}</Label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(event) =>
                  setForm((state) => ({ ...state, title: event.target.value }))
                }
                placeholder={t.tasks.titlePlaceholder}
                required
                autoFocus
                className="h-10 rounded-xl"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="task-subject">{t.tasks.subject}</Label>
                <Input
                  id="task-subject"
                  value={form.subject}
                  onChange={(event) =>
                    setForm((state) => ({
                      ...state,
                      subject: event.target.value,
                    }))
                  }
                  placeholder={t.tasks.subjectPlaceholder}
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-due">{t.tasks.dueDate}</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) =>
                    setForm((state) => ({
                      ...state,
                      dueDate: event.target.value,
                    }))
                  }
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t.tasks.status}</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((state) => ({
                      ...state,
                      status: value as TaskStatus,
                    }))
                  }
                >
                  <SelectTrigger className="h-10 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">{t.tasks.statusTodo}</SelectItem>
                    <SelectItem value="IN_PROGRESS">
                      {t.tasks.statusInProgress}
                    </SelectItem>
                    <SelectItem value="DONE">{t.tasks.statusDone}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t.tasks.priority}</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) =>
                    setForm((state) => ({
                      ...state,
                      priority: value as TaskPriority,
                    }))
                  }
                >
                  <SelectTrigger className="h-10 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">{t.tasks.priorityLow}</SelectItem>
                    <SelectItem value="MEDIUM">
                      {t.tasks.priorityMedium}
                    </SelectItem>
                    <SelectItem value="HIGH">{t.tasks.priorityHigh}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-description">{t.tasks.description}</Label>
              <Textarea
                id="task-description"
                value={form.description}
                onChange={(event) =>
                  setForm((state) => ({
                    ...state,
                    description: event.target.value,
                  }))
                }
                placeholder={t.tasks.descriptionPlaceholder}
                rows={3}
                className="rounded-xl"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                className="rounded-xl"
              >
                {t.common.cancel}
              </Button>
              <Button
                type="submit"
                disabled={saving || !form.title.trim()}
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

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.tasks.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.tasks.deleteBody}
            </AlertDialogDescription>
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
