import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE, createTranslator, directionOf } from "@icosium/i18n";
import { VoiceBar } from "@/components/voice-bar";
import { Providers } from "./providers";
import "./globals.css";

const t = createTranslator(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: t("app.name"),
  description: t("app.tagline"),
  applicationName: t("app.name"),
  appleWebApp: { capable: true, title: t("app.name"), statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6efe3" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1712" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={DEFAULT_LOCALE} dir={directionOf(DEFAULT_LOCALE)}>
      <body className="min-h-dvh bg-bg text-ink antialiased">
        <Providers>
          <VoiceBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
