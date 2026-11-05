import type { MessageKey } from "@icosium/i18n";

export type AuthMode = "signIn" | "signUp" | "guest";

/** Erreur renvoyée par Supabase Auth, réduite à ce qui sert à choisir le message. */
export type AuthFailure = { status: number; code: string; message: string };

export function readAuthError(error: unknown): AuthFailure {
  if (typeof error === "object" && error !== null) {
    const e = error as { status?: number; code?: string; message?: string; name?: string };
    const network = e.name === "AuthRetryableFetchError" || e.name === "TypeError";
    return { status: network ? 0 : (e.status ?? 0), code: e.code ?? "", message: e.message ?? "" };
  }
  return { status: 0, code: "", message: String(error) };
}

/** Transforme une erreur Supabase Auth en texte à afficher. */
export function authErrorKey(mode: AuthMode, failure: AuthFailure): MessageKey {
  const { code, status } = failure;
  const message = failure.message.toLowerCase();
  if (status === 0) return "auth.error.network";
  // Refus précis de la base (âge, pseudo), quand Supabase transmet le message du trigger.
  if (message.includes("too_young")) return "auth.error.tooYoung";
  if (message.includes("invalid_birthdate")) return "auth.error.invalidBirthdate";
  if (message.includes("invalid_username")) return "auth.error.invalidUsername";
  if (message.includes("username_taken")) return "auth.error.usernameTaken";
  if (message.includes("age_not_confirmed")) return "auth.error.ageNotConfirmed";
  if (code === "user_already_exists" || code === "email_exists") return "auth.error.emailTaken";
  if (code === "invalid_credentials") return "auth.error.badCredentials";
  if (code === "email_not_confirmed") return "auth.error.emailNotConfirmed";
  if (code === "weak_password") return "auth.error.weakPassword";
  if (code === "anonymous_provider_disabled") return "auth.error.guestDisabled";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit") return "auth.error.tooManyAttempts";
  // Le refus de la base (âge, pseudo) arrive sous la forme d'une erreur générique.
  if (message.includes("database error saving new user")) {
    return mode === "guest" ? "auth.error.ageNotConfirmed" : "auth.error.signupRefused";
  }
  return "auth.error.unknown";
}

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
export const MIN_PASSWORD_LENGTH = 8;
