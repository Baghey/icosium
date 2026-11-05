"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";
import { BottomNav } from "./bottom-nav";

/** Page réservée aux personnes connectées, avec la navigation du bas. */
/** bare : plein écran sans navigation du bas (conversation). */
export function AppShell({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  const t = useT();
  const router = useRouter();
  const { ready, user } = useAuth();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return <p className="p-6 text-center text-cafe-muted">{t("common.loading")}</p>;
  }

  if (bare) return <>{children}</>;

  return (
    <>
      <main className="mx-auto max-w-xl px-4 pt-6 pb-[calc(8rem+env(safe-area-inset-bottom))]">{children}</main>
      <BottomNav />
    </>
  );
}
