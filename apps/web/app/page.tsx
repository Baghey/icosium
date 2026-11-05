"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MessageKey } from "@icosium/i18n";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";

type Status = { accounts: boolean; games: boolean; voice: boolean } | null;

const SERVICES: { key: "accounts" | "games" | "voice"; label: MessageKey }[] = [
  { key: "accounts", label: "home.service.accounts" },
  { key: "games", label: "home.service.games" },
  { key: "voice", label: "home.service.voice" },
];

export default function HomePage() {
  return (
    <AppShell>
      <Home />
    </AppShell>
  );
}

function Home() {
  const t = useT();
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    fetch("/api/status", { cache: "no-store" })
      .then((r) => r.json() as Promise<Status>)
      .then(setStatus)
      .catch(() => setStatus({ accounts: false, games: false, voice: false }));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium tracking-wide text-mint">{t("app.name")}</p>
        <h1 className="text-2xl font-semibold">{t("home.greeting", { name: user?.username ?? "" })}</h1>
        <p className="text-ink-muted">{t("home.intro")}</p>
      </header>

      <Link
        href="/voice"
        className="flex min-h-14 items-center justify-center rounded-card bg-mint px-6 text-lg font-semibold text-mint-ink transition-transform duration-150 active:scale-[0.98]"
      >
        {t("home.openVoice")}
      </Link>

      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">{t("home.status")}</h2>
        <ul className="flex flex-col gap-2">
          {SERVICES.map((s) => {
            const value = status?.[s.key];
            return (
              <li key={s.key} className="flex items-center justify-between gap-3 text-sm">
                <span>{t(s.label)}</span>
                <span className={value === undefined ? "text-ink-muted" : value ? "text-mint" : "text-danger"}>
                  {value === undefined ? t("home.statusChecking") : value ? t("home.statusOk") : t("home.statusDown")}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
