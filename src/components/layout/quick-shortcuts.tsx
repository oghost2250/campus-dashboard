"use client";

import {
  BookOpen,
  Bus,
  CalendarDays,
  ExternalLink,
  GraduationCap,
  Mail,
} from "lucide-react";

import { cn } from "@/lib/utils";

type Shortcut = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const SHORTCUTS: Shortcut[] = [
  { label: "Moodle", href: "https://moodle.zewailcity.edu.eg", icon: BookOpen },
  { label: "Webmail", href: "https://mail.google.com", icon: Mail },
  { label: "Student Portal", href: "https://portal.zewailcity.edu.eg", icon: GraduationCap },
  { label: "Bus Schedule", href: "#bus-schedule", icon: Bus },
  { label: "Academic Calendar", href: "#calendar", icon: CalendarDays },
];

export function QuickShortcuts() {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {SHORTCUTS.map((shortcut) => {
        const Icon = shortcut.icon;
        const isExternal = shortcut.href.startsWith("http");
        return (
          <a
            key={shortcut.label}
            href={shortcut.href}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-zinc-900/60 px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-zinc-800 hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            <span className="whitespace-nowrap">{shortcut.label}</span>
            {isExternal && <ExternalLink className="size-3 opacity-60" />}
          </a>
        );
      })}
    </div>
  );
}

export default QuickShortcuts;
