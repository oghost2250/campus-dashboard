"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  ExternalLink,
  FolderGit2,
  GitBranch,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatDate, toDateInputValue } from "@/lib/format";
import type { ProjectDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

type Status = "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";

type FormState = {
  title: string;
  description: string;
  techStack: string;
  repoUrl: string;
  liveUrl: string;
  status: Status;
  completedAt: string;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  techStack: "",
  repoUrl: "",
  liveUrl: "",
  status: "COMPLETED",
  completedAt: "",
};

function parseTech(value: string): string[] {
  const unique = new Set<string>();
  for (const raw of value.split(",")) {
    const tech = raw.trim().slice(0, 30);
    if (tech) unique.add(tech);
    if (unique.size >= 12) break;
  }
  return [...unique];
}

export function ProjectShowcase({
  initialProjects,
}: {
  initialProjects: ProjectDTO[];
}) {
  const { t, locale } = useI18n();

  const [projects, setProjects] = useState(initialProjects);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectDTO | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectDTO | null>(null);

  useEffect(() => setProjects(initialProjects), [initialProjects]);

  const sorted = useMemo(
    () =>
      [...projects].sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      }),
    [projects],
  );

  const completed = projects.filter(
    (project) => project.status === "COMPLETED",
  ).length;
  const techCount = new Set(projects.flatMap((project) => project.techStack))
    .size;

  function statusLabel(status: Status) {
    return status === "COMPLETED"
      ? t.projects.statusCompleted
      : status === "IN_PROGRESS"
        ? t.projects.statusInProgress
        : t.projects.statusArchived;
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(project: ProjectDTO) {
    setEditing(project);
    setForm({
      title: project.title,
      description: project.description ?? "",
      techStack: project.techStack.join(", "),
      repoUrl: project.repoUrl ?? "",
      liveUrl: project.liveUrl ?? "",
      status: project.status,
      completedAt: toDateInputValue(project.completedAt),
    });
    setDialogOpen(true);
  }

  async function saveProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      techStack: parseTech(form.techStack),
      repoUrl: form.repoUrl.trim() || null,
      liveUrl: form.liveUrl.trim() || null,
      status: form.status,
      completedAt: form.completedAt || null,
    };

    try {
      const response = await fetch(
        editing ? `/api/projects/${editing.id}` : "/api/projects",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) throw new Error("request failed");

      const data = (await response.json()) as { project: ProjectDTO };
      setProjects((current) =>
        editing
          ? current.map((item) =>
              item.id === data.project.id ? data.project : item,
            )
          : [data.project, ...current],
      );

      toast.success(t.projects.saved);
      setDialogOpen(false);
    } catch {
      toast.error(t.common.error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleFeatured(project: ProjectDTO) {
    const next = !project.featured;
    const snapshot = projects;
    setProjects((current) =>
      current.map((item) =>
        item.id === project.id ? { ...item, featured: next } : item,
      ),
    );

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: next }),
      });
      if (!response.ok) throw new Error("request failed");
    } catch {
      setProjects(snapshot);
      toast.error(t.common.error);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    const snapshot = projects;
    setProjects((current) => current.filter((item) => item.id !== target.id));

    try {
      const response = await fetch(`/api/projects/${target.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("request failed");
      toast.success(t.projects.deleted);
    } catch {
      setProjects(snapshot);
      toast.error(t.common.error);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.projects.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.projects.subtitle}</p>
        </div>
        <Button className="h-9 rounded-xl" onClick={openCreate}>
          <Plus className="size-4" />
          {t.projects.new}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t.projects.statsTotal, value: projects.length },
          { label: t.projects.statusCompleted, value: completed },
          { label: t.projects.technologies, value: techCount },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border/60 bg-card/60 px-3 py-2.5 backdrop-blur-sm"
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-card/40 px-6 py-16 text-center">
          <div className="grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <FolderGit2 className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">{t.projects.empty}</p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={openCreate}
          >
            <Plus className="size-3.5" />
            {t.projects.addFirst}
          </Button>
        </div>
      ) : (
        <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {sorted.map((project) => (
              <motion.article
                key={project.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  "group flex flex-col rounded-2xl border bg-card/70 p-4 shadow-soft backdrop-blur-sm transition-colors",
                  project.featured
                    ? "border-primary/35 ring-1 ring-primary/10"
                    : "border-border/70 hover:border-primary/25",
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="truncate text-sm font-semibold tracking-tight">
                        {project.title}
                      </h2>
                      {project.featured ? (
                        <Star className="size-3.5 shrink-0 fill-warning text-warning" />
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "rounded-md px-1.5 py-0 text-[10px] font-normal",
                          project.status === "COMPLETED" &&
                            "bg-success/12 text-success",
                          project.status === "IN_PROGRESS" &&
                            "bg-primary/10 text-primary",
                        )}
                      >
                        {statusLabel(project.status)}
                      </Badge>
                      {project.completedAt ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <CalendarDays className="size-3" />
                          {formatDate(project.completedAt, locale, {
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleFeatured(project)}
                    aria-label={
                      project.featured
                        ? t.projects.unfeature
                        : t.projects.feature
                    }
                    aria-pressed={project.featured}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-muted hover:text-warning"
                  >
                    <Star
                      className={cn(
                        "size-4",
                        project.featured && "fill-warning text-warning",
                      )}
                    />
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 rounded-lg"
                        aria-label={t.common.actions}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => openEdit(project)}
                      >
                        <Pencil className="size-4" />
                        {t.common.edit}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        className="cursor-pointer"
                        onClick={() => setDeleteTarget(project)}
                      >
                        <Trash2 className="size-4" />
                        {t.common.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="mt-2 line-clamp-3 text-[12.5px] leading-relaxed text-muted-foreground">
                  {project.description || t.projects.noDescription}
                </p>

                {project.techStack.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {project.techStack.slice(0, 5).map((tech) => (
                      <span
                        key={tech}
                        className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {tech}
                      </span>
                    ))}
                    {project.techStack.length > 5 ? (
                      <span className="px-1 text-[10px] text-muted-foreground">
                        +{project.techStack.length - 5}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-auto flex items-center gap-1 pt-4">
                  {project.repoUrl ? (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground"
                    >
                      <a
                        href={project.repoUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        <GitBranch className="size-3.5" />
                        {t.projects.repository}
                      </a>
                    </Button>
                  ) : null}
                  {project.liveUrl ? (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground"
                    >
                      <a
                        href={project.liveUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        <ExternalLink className="size-3.5" />
                        {t.projects.liveDemo}
                      </a>
                    </Button>
                  ) : null}
                  {!project.repoUrl && !project.liveUrl ? (
                    <span className="text-[11px] text-muted-foreground/70">
                      {t.projects.noLinks}
                    </span>
                  ) : null}
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? t.projects.editTitle : t.projects.createTitle}
            </DialogTitle>
            <DialogDescription>{t.projects.subtitle}</DialogDescription>
          </DialogHeader>

          <form onSubmit={saveProject} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="project-title">{t.projects.projectTitle}</Label>
                <Input
                  id="project-title"
                  value={form.title}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, title: event.target.value }))
                  }
                  placeholder={t.projects.titlePlaceholder}
                  required
                  autoFocus
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t.projects.status}</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((state) => ({
                      ...state,
                      status: value as Status,
                    }))
                  }
                >
                  <SelectTrigger className="h-10 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPLETED">
                      {t.projects.statusCompleted}
                    </SelectItem>
                    <SelectItem value="IN_PROGRESS">
                      {t.projects.statusInProgress}
                    </SelectItem>
                    <SelectItem value="ARCHIVED">
                      {t.projects.statusArchived}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-description">
                {t.projects.description}
              </Label>
              <Textarea
                id="project-description"
                value={form.description}
                onChange={(event) =>
                  setForm((state) => ({
                    ...state,
                    description: event.target.value,
                  }))
                }
                placeholder={t.projects.descriptionPlaceholder}
                rows={4}
                className="resize-y rounded-xl"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="project-tech">{t.projects.techStack}</Label>
                <Input
                  id="project-tech"
                  value={form.techStack}
                  onChange={(event) =>
                    setForm((state) => ({
                      ...state,
                      techStack: event.target.value,
                    }))
                  }
                  placeholder={t.projects.techPlaceholder}
                  className="h-10 rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">
                  {t.projects.techHint}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project-date">{t.projects.completedAt}</Label>
                <Input
                  id="project-date"
                  type="date"
                  value={form.completedAt}
                  onChange={(event) =>
                    setForm((state) => ({
                      ...state,
                      completedAt: event.target.value,
                    }))
                  }
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project-repo">{t.projects.repoUrl}</Label>
                <Input
                  id="project-repo"
                  type="url"
                  value={form.repoUrl}
                  onChange={(event) =>
                    setForm((state) => ({
                      ...state,
                      repoUrl: event.target.value,
                    }))
                  }
                  placeholder="https://github.com/…"
                  dir="ltr"
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project-live">{t.projects.liveUrl}</Label>
                <Input
                  id="project-live"
                  type="url"
                  value={form.liveUrl}
                  onChange={(event) =>
                    setForm((state) => ({
                      ...state,
                      liveUrl: event.target.value,
                    }))
                  }
                  placeholder="https://…"
                  dir="ltr"
                  className="h-10 rounded-xl"
                />
              </div>
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
            <AlertDialogTitle>{t.projects.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.projects.deleteBody}
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
