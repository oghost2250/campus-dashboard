import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";

import "./globals.css";
import { Providers } from "@/components/providers";
import { getLocale } from "@/lib/session";
import { dictionaries } from "@/i18n";
import { dirFor } from "@/i18n/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-ibm-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  // English pages never use this family; only fetch it when the locale is Arabic.
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = dictionaries[locale];

  return {
    title: {
      default: `${t.common.appName} — ${t.common.tagline}`,
      template: `%s · ${t.common.appName}`,
    },
    description: t.common.tagline,
    applicationName: t.common.appName,
    appleWebApp: {
      capable: true,
      title: "Campus",
      statusBarStyle: "default",
    },
    icons: {
      apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    },
    authors: [{ name: t.common.appName }],
    openGraph: {
      title: `${t.common.appName} — ${t.common.tagline}`,
      description: t.common.tagline,
      type: "website",
      locale: locale === "ar" ? "ar_EG" : "en_US",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#12121a" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      dir={dirFor(locale)}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${plexArabic.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
