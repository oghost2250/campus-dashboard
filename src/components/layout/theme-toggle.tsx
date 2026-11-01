"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";

const order = ["light", "dark", "system"] as const;

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = (mounted ? (theme ?? "system") : "system") as (typeof order)[number];
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  const label =
    current === "light"
      ? t.common.light
      : current === "dark"
        ? t.common.dark
        : t.common.system;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-lg"
          aria-label={`${t.common.theme}: ${label}`}
          onClick={() => {
            const index = order.indexOf(current);
            const next = order[(index + 1) % order.length];
            setTheme(next);
            void fetch("/api/profile", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ theme: next }),
            }).catch(() => {});
          }}
        >
          {mounted ? (
            <Icon className="size-[18px]" />
          ) : (
            <Sun className="size-[18px] opacity-0" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>
        {t.common.theme} · {label}
        <span className="sr-only">{resolvedTheme}</span>
      </TooltipContent>
    </Tooltip>
  );
}
