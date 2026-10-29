"use client";

import { Languages } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";

export function LocaleToggle() {
  const { locale, toggleLocale, t } = useI18n();
  const next = locale === "ar" ? "EN" : "AR";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLocale}
          aria-label={`${t.common.language}: ${next}`}
          className="h-9 gap-1.5 rounded-lg px-2.5"
        >
          <Languages className="size-[18px]" />
          <motion.span
            key={locale}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="text-xs font-semibold tracking-wide"
          >
            {next}
          </motion.span>
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{t.common.language}</TooltipContent>
    </Tooltip>
  );
}
