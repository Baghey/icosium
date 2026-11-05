"use client";

import { checkBirthdate } from "@icosium/shared";
import type { MessageKey } from "@icosium/i18n";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { LanguagePicker } from "@/components/language-picker";
import { useAuth } from "@/lib/auth-context";
import { MIN_PASSWORD_LENGTH, USERNAME_PATTERN, authErrorKey, readAuthError, type AuthMode } from "@/lib/auth-errors";
import { useT } from "@/lib/i18n";

const TABS: { mode: AuthMode; label: MessageKey }[] = [
  { mode: "signIn", label: "auth.signIn" },
  { mode: "signUp", label: "auth.signUp" },
  { mode: "guest", label: "auth.guest" },
];

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const auth = useAuth();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [notice, setNotice] = useState<MessageKey | null>(null);

  useEffect(() => {
    if (auth.ready && auth.user) router.replace("/");
  }, [auth.ready, auth.user, router]);

  /** Vérifications rapides côté app ; le serveur refait les mêmes et a le dernier mot. */
  function localCheck(): MessageKey | null {
    if (mode === "guest") return ageConfirmed ? null : "auth.error.ageNotConfirmed";
    if (password.length < MIN_PASSWORD_LENGTH) return "auth.error.weakPassword";
    if (mode === "signUp") {
      if (!USERNAME_PATTERN.test(username)) return "auth.error.invalidUsername";
      const age = checkBirthdate(birthdate);
      if (!age.ok) return age.reason === "too_young" ? "auth.error.tooYoung" : "auth.error.invalidBirthdate";
    }
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = localCheck();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signIn") {
        await auth.signIn(email.trim(), password);
      } else if (mode === "signUp") {
        if (!(await auth.isUsernameAvailable(username))) {
          setError("auth.error.usernameTaken");
          return;
        }
        const result = await auth.signUp(email.trim(), password, username, birthdate);
        if (result === "confirmEmail") {
          setNotice("auth.checkEmail");
          setMode("signIn");
          return;
        }
      } else {
        await auth.signInAsGuest();
      }
      router.replace("/");
    } catch (err) {
      setError(authErrorKey(mode, readAuthError(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-3xl font-semibold tracking-wide">{t("app.name")}</h1>
        <p className="text-ink-muted">{t("app.tagline")}</p>
      </header>

      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-control bg-surface-2 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            aria-selected={mode === tab.mode}
            onClick={() => {
              setMode(tab.mode);
              setError(null);
            }}
            className={`min-h-touch rounded-[calc(var(--radius-control)-0.25rem)] text-sm font-medium transition-colors duration-200 ${
              mode === tab.mode ? "bg-surface text-ink shadow-sm" : "text-ink-muted"
            }`}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {mode === "guest" ? (
          <>
            <p className="text-ink-muted">{t("auth.guestIntro")}</p>
            <label className="flex min-h-touch items-center gap-3">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="size-5 accent-mint"
              />
              <span>{t("auth.guestAge")}</span>
            </label>
          </>
        ) : (
          <>
            <Field label={t("auth.email")}>
              {(id) => (
                <input id={id} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
              )}
            </Field>
            <Field label={t("auth.password")} hint={mode === "signUp" ? t("auth.passwordHint") : undefined}>
              {(id) => (
                <input
                  id={id}
                  type="password"
                  autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={INPUT}
                />
              )}
            </Field>
            {mode === "signUp" && (
              <>
                <Field label={t("auth.username")} hint={t("auth.usernameHint")}>
                  {(id) => (
                    <input id={id} autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} className={INPUT} />
                  )}
                </Field>
                <Field label={t("auth.birthdate")} hint={t("auth.birthdateHint")}>
                  {(id) => (
                    <input id={id} type="date" autoComplete="bday" required value={birthdate} onChange={(e) => setBirthdate(e.target.value)} className={INPUT} />
                  )}
                </Field>
              </>
            )}
          </>
        )}

        {notice && (
          <p role="status" className="rounded-control bg-mint-soft p-3 text-sm text-ink">
            {t(notice)}
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-control bg-surface-2 p-3 text-sm text-danger">
            {t(error)}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex min-h-14 items-center justify-center rounded-card bg-mint px-6 text-lg font-semibold text-mint-ink transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
        >
          {busy
            ? t("auth.working")
            : mode === "signIn"
              ? t("auth.submitSignIn")
              : mode === "signUp"
                ? t("auth.submitSignUp")
                : t("auth.continueAsGuest")}
        </button>
      </form>

      <LanguagePicker />
    </main>
  );
}

const INPUT =
  "min-h-touch w-full rounded-control border border-line bg-surface px-3 text-base text-ink outline-none transition-colors duration-200 focus:border-mint";

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
