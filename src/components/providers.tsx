"use client";

import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/i18n/provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import type { Locale } from "@/i18n/config";
import type { ReactNode } from "react";

export function Providers({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Keep color transitions smooth when the class flips.
      disableTransitionOnChange={false}
    >
      <I18nProvider initialLocale={initialLocale}>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
