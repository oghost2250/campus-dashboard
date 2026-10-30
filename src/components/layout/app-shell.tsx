"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { BottomTabs } from "@/components/layout/bottom-tabs";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar, type ShellUser } from "@/components/layout/topbar";
import { useI18n } from "@/i18n/provider";

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { isRtl, t } = useI18n();

  return (
    <div className="relative min-h-dvh bg-mesh">
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-[268px] border-e border-border/60 bg-sidebar/75 backdrop-blur-xl lg:block">
        <SidebarNav
          scope="desktop"
          role={user.role}
          isDeveloper={user.isDeveloper}
        />
      </aside>

      <div className="lg:ps-[268px]">
        <Topbar user={user} onOpenSidebar={() => setMobileOpen(true)} />

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side={isRtl ? "right" : "left"}
            className="w-[286px] gap-0 p-0"
          >
            <SheetTitle className="sr-only">{t.common.openMenu}</SheetTitle>
            <SheetDescription className="sr-only">
              {t.nav.overview}
            </SheetDescription>
            <SidebarNav
              scope="mobile"
              role={user.role}
              isDeveloper={user.isDeveloper}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 md:px-8 md:pt-8 lg:pb-20">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <BottomTabs />
    </div>
  );
}
