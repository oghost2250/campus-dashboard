"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { CodeBlock } from "@/components/snippets/code-block";
import { useI18n } from "@/i18n/provider";
import { languageLabel, snippetLanguages } from "@/lib/languages";
import type { SnippetDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

type FormState = {
  title: string;
  language: string;
  tags: string;
  code: string;
  isFavorite: boolean;
};

const emptyForm: FormState = {
  title: "",
  language: "typescript",
  tags: "",
  code: "",
  isFavorite: false,
};

function parseTags(value: string): string[] {
  const unique = new Set<string>();
  for (const raw of value.split(",")) {
    const tag = raw.trim().slice(0, 24);
    if (tag) unique.add(tag);
    if (unique.size >= 10) break;
  }
  return [...unique];
}

function previewOf(code: string, lines = 7) {
  const all = code.split("\n");
  if (all.length <= lines) return code;
  return `${all.slice(0, lines).join("\n")}\n…`;
}

export function SnippetGrid({
  initialSnippets,
}: {
  initialSnippets: SnippetDTO[];
}) {
  const { t } = useI18n();

  const [snippets, setSnippets] = useState(initialSnippets);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SnippetDTO | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState<SnippetDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SnippetDTO | null>(null);
  const [shareTarget, setShareTarget] = useState<SnippetDTO | null>(null);
  const [sharing, setSharing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setSnippets(initialSnippets), [initialSnippets]);
  useEffect(() => setOrigin(window.location.origin), []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return snippets
      .filter((snippet) => {
        if (favoritesOnly && !snippet.isFavorite) return false;
        if (language !== "all" && snippet.language !== language) return false;
        if (!needle) return true;

        return (
          snippet.title.toLowerCase().includes(needle) ||
          snippet.language.toLowerCase().includes(needle) ||
          snippet.code.toLowerCase().includes(needle) ||
          snippet.tags.some((tag) => tag.toLowerCase().includes(needle))
        );
      })
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [snippets, query, language, favoritesOnly]);

  const favoriteCount = snippets.filter((snippet) => snippet.isFavorite).length;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(snippet: SnippetDTO) {
    setEditing(snippet);
    setForm({
      title: snippet.title,
      language: snippet.language,
      tags: snippet.tags.join(", "),
      code: snippet.code,
      isFavorite: snippet.isFavorite,
    });
    setDialogOpen(true);
  }

  async function saveSnippet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.code.trim()) return;

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      language: form.language,
      tags: parseTags(form.tags),
      code: form.code,
      isFavorite: form.isFavorite,
    };

    try {
      const response = await fetch(
        editing ? `/api/snippets/${editing.id}` : "/api/snippets",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) throw new Error("request failed");

      const data = (await response.json()) as { snippet: SnippetDTO };
      setSnippets((current) =>
        editing
          ? current.map((item) =>
              item.id === data.snippet.id ? data.snippet : item,
            )
          : [data.snippet, ...current],
      );

      toast.success(t.snippets.saved);
      setDialogOpen(false);
    } catch {
      toast.error(t.common.error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleFavorite(snippet: SnippetDTO) {
    const next = !snippet.isFavorite;
    const snapshot = snippets;

    setSnippets((current) =>
      current.map((item) =>
        item.id === snippet.id ? { ...item, isFavorite: next } : item,
      ),
    );

    try {
      const response = await fetch(`/api/snippets/${snippet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: next }),
      });
      if (!response.ok) throw new Error("request failed");
    } catch {
      setSnippets(snapshot);
      toast.error(t.common.error);
    }
  }

  async function copySnippet(snippet: SnippetDTO) {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopiedId(snippet.id);
      toast.success(t.snippets.copied);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      toast.error(t.common.error);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    const snapshot = snippets;

    setSnippets((current) => current.filter((item) => item.id !== target.id));

    try {
      const response = await fetch(`/api/snippets/${target.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("request failed");
      toast.success(t.snippets.deleted);
    } catch {
      setSnippets(snapshot);
      toast.error(t.common.error);
    }
  }

  function openShare(snippet: SnippetDTO) {
    setLinkCopied(false);
    setShareTarget(snippet);
  }

  async function toggleShare() {
    if (!shareTarget) return;

    const next = !shareTarget.isPublic;
    setSharing(true);

    try {
      const response = await fetch(
        `/api/snippets/${shareTarget.id}/share`,
        { method: next ? "POST" : "DELETE" },
      );
      if (!response.ok) throw new Error("request failed");

      const data = (await response.json()) as { snippet: SnippetDTO | null };
      if (!data.snippet) throw new Error("request failed");

      const updated = data.snippet;
      setSnippets((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setShareTarget(updated);
      toast.success(
        next ? t.snippets.shareEnabled : t.snippets.shareDisabled,
      );
    } catch {
      toast.error(t.common.error);
    } finally {
      setSharing(false);
    }
  }

  async function copyShareLink(snippet: SnippetDTO) {
    if (!snippet.shareSlug) return;

    try {
      await navigator.clipboard.writeText(`${origin}/s/${snippet.shareSlug}`);
      setLinkCopied(true);
      toast.success(t.snippets.linkCopied);
      window.setTimeout(() => setLinkCopied(false), 1600);
    } catch {
      toast.error(t.common.error);
    }
  }

  const usedLanguages = [...new Set(snippets.map((item) => item.language))].sort();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.snippets.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.snippets.subtitle}</p>
        </div>
        <Button className="h-9 rounded-xl" onClick={openCreate}>
          <Plus className="size-4" />
          {t.snippets.new}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.snippets.searchPlaceholder}
            className="h-9 rounded-xl ps-9"
          />
        </div>

        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="h-9 w-[170px] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.snippets.allLanguages}</SelectItem>
            {usedLanguages.map((value) => (
              <SelectItem key={value} value={value}>
                {languageLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={favoritesOnly ? "secondary" : "outline"}
          className="h-9 rounded-xl"
          onClick={() => setFavoritesOnly((value) => !value)}
          aria-pressed={favoritesOnly}
        >
          <Star
            className={cn("size-4", favoritesOnly && "fill-current text-warning")}
          />
          {t.snippets.favorites}
          {favoriteCount > 0 ? (
            <span className="text-xs text-muted-foreground">{favoriteCount}</span>
          ) : null}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-card/40 px-6 py-16 text-center">
          <div className="grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Code2 className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            {snippets.length === 0 ? t.snippets.empty : t.snippets.emptyFiltered}
          </p>
          {snippets.length === 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={openCreate}
            >
              <Plus className="size-3.5" />
              {t.snippets.new}
            </Button>
          ) : null}
        </div>
      ) : (
        <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {filtered.map((snippet) => (
              <motion.article
                key={snippet.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18 }}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-sm transition-colors hover:border-primary/25"
              >
                <div className="flex items-start gap-2 p-4 pb-3">
                  <button
                    type="button"
                    onClick={() => setViewing(snippet)}
                    className="min-w-0 flex-1 text-start outline-none focus-visible:underline"
                    aria-label={t.snippets.view}
                  >
                    <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">
                      {snippet.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                      {languageLabel(snippet.language)}
                      {snippet.isPublic ? (
                        <span className="inline-flex items-center gap-0.5 rounded bg-success/12 px-1 py-px font-sans text-[9px] font-medium text-success">
                          <Globe className="size-2.5" />
                          {t.snippets.publicBadge}
                        </span>
                      ) : null}
                    </p>
                  </button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-lg"
                    onClick={() => toggleFavorite(snippet)}
                    aria-label={
                      snippet.isFavorite
                        ? t.snippets.unfavorite
                        : t.snippets.favorite
                    }
                    aria-pressed={snippet.isFavorite}
                  >
                    <Star
                      className={cn(
                        "size-4",
                        snippet.isFavorite
                          ? "fill-warning text-warning"
                          : "text-muted-foreground/60",
                      )}
                    />
                  </Button>

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
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => setViewing(snippet)}
                      >
                        <Code2 className="size-4" />
                        {t.snippets.view}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => openEdit(snippet)}
                      >
                        <Pencil className="size-4" />
                        {t.common.edit}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => copySnippet(snippet)}
                      >
                        <Copy className="size-4" />
                        {t.common.copy}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => openShare(snippet)}
                      >
                        <Share2 className="size-4" />
                        {t.snippets.share}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        className="cursor-pointer"
                        onClick={() => setDeleteTarget(snippet)}
                      >
                        <Trash2 className="size-4" />
                        {t.common.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="px-4">
                  <CodeBlock
                    code={previewOf(snippet.code)}
                    language={snippet.language}
                    maxHeight={150}
                    showCopy={false}
                    className="rounded-lg"
                  />
                </div>

                <div className="mt-auto flex items-center gap-1.5 p-4 pt-3">
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {snippet.tags.slice(0, 2).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="rounded-md px-1.5 py-0 text-[10px] font-normal"
                      >
                        {tag}
                      </Badge>
                    ))}
                    {snippet.tags.length > 2 ? (
                      <span className="text-[10px] text-muted-foreground">
                        +{snippet.tags.length - 2}
                      </span>
                    ) : null}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground"
                    onClick={() => copySnippet(snippet)}
                  >
                    {copiedId === snippet.id ? (
                      <Check className="size-3.5 text-success" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copiedId === snippet.id ? t.common.copied : t.common.copy}
                  </Button>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Full snippet */}
      <Dialog
        open={viewing !== null}
        onOpenChange={(open) => !open && setViewing(null)}
      >
        <DialogContent className="sm:max-w-3xl">
          {viewing ? (
            <>
              <DialogHeader>
                <DialogTitle className="pe-6 text-start">
                  {viewing.title}
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2 text-start">
                  <Badge variant="secondary" className="rounded-md font-mono text-[10px]">
                    {languageLabel(viewing.language)}
                  </Badge>
                  {viewing.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </DialogDescription>
              </DialogHeader>

              <CodeBlock
                code={viewing.code}
                language={viewing.language}
                maxHeight={460}
              />

              <DialogFooter className="gap-2">
                <Button
                  variant="ghost"
                  className="rounded-xl"
                  onClick={() => setViewing(null)}
                >
                  {t.common.close}
                </Button>
                <Button
                  className="rounded-xl"
                  onClick={() => {
                    const target = viewing;
                    setViewing(null);
                    openEdit(target);
                  }}
                >
                  <Pencil className="size-4" />
                  {t.common.edit}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Create / edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? t.snippets.editTitle : t.snippets.createTitle}
            </DialogTitle>
            <DialogDescription>{t.snippets.subtitle}</DialogDescription>
          </DialogHeader>

          <form onSubmit={saveSnippet} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="snippet-title">{t.snippets.snippetTitle}</Label>
                <Input
                  id="snippet-title"
                  value={form.title}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, title: event.target.value }))
                  }
                  placeholder={t.snippets.titlePlaceholder}
                  required
                  autoFocus
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t.snippets.language}</Label>
                <Select
                  value={form.language}
                  onValueChange={(value) =>
                    setForm((state) => ({ ...state, language: value }))
                  }
                >
                  <SelectTrigger className="h-10 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {snippetLanguages.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="snippet-tags">{t.snippets.tags}</Label>
              <Input
                id="snippet-tags"
                value={form.tags}
                onChange={(event) =>
                  setForm((state) => ({ ...state, tags: event.target.value }))
                }
                placeholder={t.snippets.tagsPlaceholder}
                className="h-10 rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">
                {t.snippets.tagsHint}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="snippet-code">{t.snippets.code}</Label>
              <Textarea
                id="snippet-code"
                value={form.code}
                onChange={(event) =>
                  setForm((state) => ({ ...state, code: event.target.value }))
                }
                placeholder={t.snippets.codePlaceholder}
                rows={12}
                required
                dir="ltr"
                spellCheck={false}
                className="max-h-[42vh] min-h-[180px] resize-y rounded-xl font-mono text-[12.5px] leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-3.5 py-2.5">
              <Label
                htmlFor="snippet-favorite"
                className="flex items-center gap-2 text-sm font-normal"
              >
                <Star className="size-4 text-warning" />
                {t.snippets.favorite}
              </Label>
              <Switch
                id="snippet-favorite"
                checked={form.isFavorite}
                onCheckedChange={(checked) =>
                  setForm((state) => ({ ...state, isFavorite: checked }))
                }
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
                disabled={saving || !form.title.trim() || !form.code.trim()}
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

      {/* Share */}
      <Dialog
        open={shareTarget !== null}
        onOpenChange={(open) => !open && setShareTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          {shareTarget ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-start">
                  <Share2 className="size-4 text-primary" />
                  {t.snippets.shareTitle}
                </DialogTitle>
                <DialogDescription className="text-start">
                  {t.snippets.shareBody}
                </DialogDescription>
              </DialogHeader>

              <p className="truncate rounded-lg bg-muted/50 px-3 py-2 text-xs font-medium">
                {shareTarget.title}
              </p>

              {shareTarget.isPublic && shareTarget.shareSlug ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      dir="ltr"
                      value={`${origin}/s/${shareTarget.shareSlug}`}
                      aria-label={t.snippets.shareTitle}
                      className="h-10 rounded-xl font-mono text-[11px]"
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-10 shrink-0 rounded-xl"
                      onClick={() => copyShareLink(shareTarget)}
                      aria-label={t.snippets.copyLink}
                    >
                      {linkCopied ? (
                        <Check className="size-4 text-success" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-lg"
                    >
                      <Link
                        href={`/s/${shareTarget.shareSlug}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="size-3.5" />
                        {t.snippets.openLink}
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-lg text-destructive hover:text-destructive"
                      onClick={toggleShare}
                      disabled={sharing}
                    >
                      {sharing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Globe className="size-3.5" />
                      )}
                      {t.snippets.disableShare}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  className="h-10 rounded-xl"
                  onClick={toggleShare}
                  disabled={sharing}
                >
                  {sharing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Share2 className="size-4" />
                  )}
                  {t.snippets.enableShare}
                </Button>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl"
                  onClick={() => setShareTarget(null)}
                >
                  {t.common.close}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.snippets.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.snippets.deleteBody}</AlertDialogDescription>
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
