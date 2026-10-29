"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { navGroups } from "@/lib/nav";
import { useI18n } from "@/i18n/provider";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { UserMenu } from "@/components/layout/user-menu";

export type ShellUser = {
  name: string | null;
  email: string;
  image: string | null;
  role: "USER" | "ADMIN";
};

function usePageTitle() {
  const pathname = usePathname();
  const { t } = useI18n();

  if (pathname === "/dashboard/settings") return t.common.settings;

  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.href === "/dashboard") {
        if (pathname === "/dashboard") return t.nav[item.id];
      } else if (pathname.startsWith(item.href)) {
        return t.nav[item.id];
      }
    }
  }

  return t.nav.dashboard;
}

export function Topbar({
  user,
  onOpenSidebar,
}: {
  user: ShellUser;
  onOpenSidebar: () => void;
}) {
  const { t } = useI18n();
  const title = usePageTitle();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="size-9 rounded-lg lg:hidden"
        onClick={onOpenSidebar}
        aria-label={t.common.openMenu}
      >
        <Menu className="size-5" />
      </Button>

      <p className="min-w-0 truncate text-sm font-semibold tracking-tight">
        {title}
      </p>

      <div className="ms-auto flex items-center gap-1">
        <LocaleToggle />
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1.5 h-5" />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
