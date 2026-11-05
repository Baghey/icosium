"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";
import { BottomNav } from "./bottom-nav";

/** Page réservée aux personnes connectées, avec la navigation du bas. */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const { ready, user } = useAuth();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return <p className="p-6 text-center text-ink-muted">{t("common.loading")}</p>;
  }

  return (
    <>
      <main className="mx-auto max-w-xl px-4 pt-6 pb-28">{children}</main>
      <BottomNav />
    </>
  );
}
