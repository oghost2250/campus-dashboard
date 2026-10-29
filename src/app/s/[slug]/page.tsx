import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Code2, GraduationCap } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/session";
import { dictionaries } from "@/i18n";
import { formatDate } from "@/lib/format";
import { languageLabel } from "@/lib/languages";
import { CodeBlock } from "@/components/snippets/code-block";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PageProps = { params: Promise<{ slug: string }> };

async function findSharedSnippet(slug: string) {
  return prisma.snippet.findFirst({
    where: { shareSlug: slug, isPublic: true },
    include: { user: { select: { name: true } } },
  });
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const snippet = await findSharedSnippet(slug);

  if (!snippet) return { title: "Snippet not found" };

  return {
    title: snippet.title,
    description: snippet.code.slice(0, 150),
  };
}

export default async function SharedSnippetPage({ params }: PageProps) {
  const { slug } = await params;
  const snippet = await findSharedSnippet(slug);

  if (!snippet) notFound();

  const locale = await getLocale();
  const t = dictionaries[locale];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(48rem 26rem at 50% -12%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%)",
        }}
      />

      <header className="relative mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-chart-3 text-primary-foreground shadow-sm">
            <GraduationCap className="size-[18px]" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            {t.common.appName}
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <LocaleToggle />
          <ThemeToggle />
          <Button asChild size="sm" className="ms-1 h-9 rounded-lg">
            <Link href="/dashboard">{t.snippets.openApp}</Link>
          </Button>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6">
        <article className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-soft backdrop-blur-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <Code2 className="size-3.5 text-primary" />
                {t.snippets.publicSubtitle}
              </p>
              <h1 className="mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl">
                {snippet.title}
              </h1>
            </div>
            <Badge
              variant="secondary"
              className="rounded-md font-mono text-[10px]"
            >
              {languageLabel(snippet.language)}
            </Badge>
          </div>

          {snippet.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {snippet.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <p className="mt-3 text-[11px] text-muted-foreground">
            {t.snippets.sharedBy} {snippet.user.name ?? t.common.appName} ·{" "}
            {formatDate(snippet.updatedAt, locale, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>

          <div className="mt-4">
            <CodeBlock code={snippet.code} language={snippet.language} />
          </div>
        </article>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          {t.common.tagline}
        </p>
      </main>
    </div>
  );
}
