"use client";

import type { MessageKey } from "@icosium/i18n";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
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
      {user?.isGuest && <GuestRename current={user.username} />}
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

const RENAME_ERRORS: Record<string, MessageKey> = {
  invalid: "auth.error.invalidUsername",
  taken: "auth.error.usernameTaken",
  not_guest: "auth.error.unknown",
};

/** Un invité choisit son pseudo (les autres le voient à table). */
function GuestRename({ current }: { current: string }) {
  const t = useT();
  const { renameGuest } = useAuth();
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; key: MessageKey } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await renameGuest(name.trim());
      setMessage(result === "ok" ? { ok: true, key: "profile.renamed" } : { ok: false, key: RENAME_ERRORS[result] ?? "auth.error.unknown" });
    } catch {
      setMessage({ ok: false, key: "auth.error.network" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <label htmlFor="guest-name" className="text-sm font-semibold text-ink-muted">
        {t("profile.rename")}
      </label>
      <div className="flex gap-2">
        <input
          id="guest-name"
          value={name}
          maxLength={20}
          autoCapitalize="none"
          onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))}
          className="min-h-touch w-0 flex-1 rounded-control border border-line bg-bg px-3 focus:border-mint focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || name.trim() === current}
          className="min-h-touch rounded-control bg-ink px-4 font-semibold text-bg transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
        >
          {t("profile.renameSave")}
        </button>
      </div>
      <p className="text-xs text-ink-muted">{t("auth.usernameHint")}</p>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-mint" : "text-danger"}`}>
          {t(message.key)}
        </p>
      )}
    </form>
  );
}
