"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Code2,
  GraduationCap,
  Timer,
  TrendingUp,
} from "lucide-react";

import { useI18n } from "@/i18n/provider";

const fade = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function AuthShowcase() {
  const { t } = useI18n();

  const points = [
    t.auth.marketingPoint1,
    t.auth.marketingPoint2,
    t.auth.marketingPoint3,
  ];

  return (
    <aside className="relative hidden overflow-hidden border-e border-border/60 bg-mesh lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(40rem 24rem at 15% 8%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 62%)",
        }}
      />

      <motion.div
        initial="hidden"
        animate="show"
        custom={0}
        variants={fade}
        className="relative flex items-center gap-3"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-chart-3 text-primary-foreground shadow-soft">
          <GraduationCap className="size-5" />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">
            {t.common.appName}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Student &amp; developer OS
          </span>
        </div>
      </motion.div>

      <div className="relative max-w-md">
        <motion.h1
          initial="hidden"
          animate="show"
          custom={1}
          variants={fade}
          className="text-balance text-[2.1rem] font-semibold leading-[1.15] tracking-tight"
        >
          {t.auth.marketingTitle}
        </motion.h1>

        <ul className="mt-7 space-y-3">
          {points.map((point, index) => (
            <motion.li
              key={point}
              initial="hidden"
              animate="show"
              custom={index + 2}
              variants={fade}
              className="flex items-start gap-2.5 text-sm text-muted-foreground"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{point}</span>
            </motion.li>
          ))}
        </ul>

        <div className="relative mt-10 h-[168px]">
          <motion.div
            initial={{ opacity: 0, y: 24, rotate: -2 }}
            animate={{ opacity: 1, y: 0, rotate: -2 }}
            transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute start-0 top-0 w-[248px] rounded-2xl glass p-4 shadow-soft"
          >
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Code2 className="size-3.5 text-primary" />
              snippets / debounce.ts
            </div>
            <div className="mt-3 space-y-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
              <p>
                <span className="text-primary">export function</span> debounce(
              </p>
              <p className="ps-3">fn, wait = <span className="text-chart-4">250</span></p>
              <p>) {"{"} … {"}"}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24, rotate: 2 }}
            animate={{ opacity: 1, y: 0, rotate: 2 }}
            transition={{ delay: 0.62, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute end-0 top-10 w-[210px] rounded-2xl glass p-4 shadow-soft"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">CS 340</span>
              <TrendingUp className="size-3.5 text-success" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">3.72</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-primary to-chart-2" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.74, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-0 start-16 flex items-center gap-2.5 rounded-full glass px-3.5 py-2 shadow-soft"
          >
            <Timer className="size-4 text-primary" />
            <span className="font-mono text-xs tabular-nums">25:00</span>
            <span className="text-[11px] text-muted-foreground">focus</span>
          </motion.div>
        </div>
      </div>

      <motion.p
        initial="hidden"
        animate="show"
        custom={6}
        variants={fade}
        className="relative text-xs text-muted-foreground"
      >
        {t.auth.marketingFootnote}
      </motion.p>
    </aside>
  );
}
