"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

const SyntaxHighlighter = dynamic(
  () =>
    import("react-syntax-highlighter/dist/esm/prism").then(
      (module) => module.default,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-24 w-full animate-pulse rounded-lg bg-muted/50" />
    ),
  },
);

type CodeBlockProps = {
  code: string;
  language: string;
  /** Clamp the visible height and scroll instead of growing. */
  maxHeight?: number;
  showCopy?: boolean;
  className?: string;
};

export function CodeBlock({
  code,
  language,
  maxHeight,
  showCopy = true,
  className,
}: CodeBlockProps) {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const [copied, setCopied] = useState(false);

  const dark = resolvedTheme !== "light";

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(t.snippets.copied);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t.common.error);
    }
  }

  return (
    <div
      dir="ltr"
      className={cn(
        "group/code relative overflow-hidden rounded-xl border border-border/60",
        dark ? "bg-[#0f1117]" : "bg-[#fbfbfe]",
        className,
      )}
    >
      {showCopy ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={copy}
          aria-label={t.common.copy}
          className={cn(
            "absolute end-2 top-2 z-10 h-7 gap-1.5 rounded-md px-2 text-[11px] backdrop-blur",
            "bg-background/70 text-muted-foreground opacity-0 transition-opacity",
            "hover:text-foreground focus-visible:opacity-100 group-hover/code:opacity-100",
          )}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? t.common.copied : t.common.copy}
        </Button>
      ) : null}

      <div
        className="overflow-auto text-[12.5px] leading-relaxed"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <SyntaxHighlighter
          language={language || "text"}
          style={dark ? oneDark : oneLight}
          customStyle={{
            margin: 0,
            padding: "0.9rem 1rem",
            background: "transparent",
            fontSize: "12.5px",
            lineHeight: 1.65,
          }}
          codeTagProps={{
            style: {
              fontFamily:
                "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
            },
          }}
          wrapLongLines={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
