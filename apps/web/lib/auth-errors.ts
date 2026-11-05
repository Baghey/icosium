import type { MessageKey } from "@icosium/i18n";

export type AuthMode = "signIn" | "signUp" | "guest";

/** Erreur renvoyée par Nakama, une fois lue. */
export type NakamaFailure = { status: number; message: string };

/** Lit l'erreur levée par nakama-js (une Response fetch) ou une erreur réseau. */
export async function readNakamaError(error: unknown): Promise<NakamaFailure> {
  if (typeof Response !== "undefined" && error instanceof Response) {
    let message = "";
    try {
      const body = (await error.json()) as { message?: string };
      message = body.message ?? "";
    } catch {
      // corps vide ou non JSON
    }
    return { status: error.status, message };
  }
  return { status: 0, message: error instanceof Error ? error.message : "" };
}

/** Transforme une erreur Nakama en texte à afficher. */
export function authErrorKey(mode: AuthMode, failure: NakamaFailure): MessageKey {
  const message = failure.message.toLowerCase();
  if (message.includes("too_young")) return "auth.error.tooYoung";
  if (message.includes("invalid_birthdate")) return "auth.error.invalidBirthdate";
  if (message.includes("age_not_confirmed")) return "auth.error.ageNotConfirmed";
  if (failure.status === 0) return "auth.error.network";
  if (failure.status === 409) return "auth.error.usernameTaken";
  if (failure.status === 401 || failure.status === 404) {
    return mode === "signUp" ? "auth.error.emailTaken" : "auth.error.badCredentials";
  }
  if (failure.status === 400 && message.includes("password")) return "auth.error.weakPassword";
  if (failure.status === 400 && message.includes("username")) return "auth.error.invalidUsername";
  return "auth.error.unknown";
}

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
export const MIN_PASSWORD_LENGTH = 8;
