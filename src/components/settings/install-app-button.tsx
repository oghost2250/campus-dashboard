"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppButton() {
  const { locale } = useI18n();
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in window.navigator &&
          Boolean(
            (window.navigator as Navigator & { standalone?: boolean }).standalone,
          )),
    );
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    void navigator.serviceWorker
      ?.register("/service-worker.js", { scope: "/" })
      .catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  const isArabic = locale === "ar";
  return (
    <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-xl text-xs text-muted-foreground">
        {installed
          ? (isArabic ? "Campus مثبت على هذا الجهاز." : "Campus is installed on this device.")
          : prompt
            ? (isArabic ? "ثبّت Campus للوصول إليه بسرعة من هاتفك." : "Install Campus for quick access from your phone.")
            : (isArabic
              ? "على iPhone: افتح الموقع في Safari، ثم مشاركة ← إضافة إلى الشاشة الرئيسية. على Android: استخدم قائمة المتصفح ثم تثبيت التطبيق."
              : "On iPhone: open Campus in Safari, tap Share, then Add to Home Screen. On Android: open the browser menu and choose Install app or Add to Home Screen.")}
      </p>
      {prompt && !installed ? (
        <Button type="button" onClick={install} className="shrink-0 rounded-xl">
          <Download className="size-4" />
          {isArabic ? "تثبيت التطبيق" : "Install app"}
        </Button>
      ) : !installed ? (
        <span className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-xs text-muted-foreground">
          <Smartphone className="size-4" />
          {isArabic ? "متاح للهاتف" : "Ready for mobile"}
        </span>
      ) : null}
    </div>
  );
}
