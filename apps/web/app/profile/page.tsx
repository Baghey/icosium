"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LanguagePicker } from "@/components/language-picker";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";

export default function ProfilePage() {
  return (
    <AppShell>
      <Profile />
    </AppShell>
  );
}

function Profile() {
  const t = useT();
  const router = useRouter();
  const { user, signOut } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("profile.title")}</h1>
      <dl className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">{t("profile.username")}</dt>
          <dd className="truncate font-medium">{user?.username}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">{t("profile.account")}</dt>
          <dd className="font-medium">{user?.isGuest ? t("profile.guestAccount") : t("profile.emailAccount")}</dd>
        </div>
      </dl>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink-muted">{t("common.language")}</h2>
        <LanguagePicker />
      </section>
      <p className="text-sm text-ink-muted">{t("profile.navigateHint")}</p>
      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.replace("/login");
        }}
        className="min-h-touch rounded-control border border-line px-4 font-medium text-danger transition-colors duration-200 hover:bg-surface-2"
      >
        {t("auth.signOut")}
      </button>
    </div>
  );
}
