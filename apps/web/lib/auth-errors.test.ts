import { describe, expect, it } from "vitest";
import { authErrorKey, readAuthError } from "./auth-errors";

describe("authErrorKey", () => {
  it("distingue mauvais identifiants et email déjà pris", () => {
    expect(authErrorKey("signIn", { status: 400, code: "invalid_credentials", message: "" })).toBe("auth.error.badCredentials");
    expect(authErrorKey("signUp", { status: 422, code: "user_already_exists", message: "" })).toBe("auth.error.emailTaken");
  });
  it("reconnaît le refus de la base à l'inscription", () => {
    expect(authErrorKey("signUp", { status: 500, code: "unexpected_failure", message: "Database error saving new user" })).toBe(
      "auth.error.signupRefused",
    );
  });
  it("transmet le refus précis de la base quand il est disponible", () => {
    expect(authErrorKey("signUp", { status: 500, code: "P0001", message: "too_young" })).toBe("auth.error.tooYoung");
  });
  it("signale un compte invité désactivé et l'email non confirmé", () => {
    expect(authErrorKey("guest", { status: 422, code: "anonymous_provider_disabled", message: "" })).toBe("auth.error.guestDisabled");
    expect(authErrorKey("signIn", { status: 400, code: "email_not_confirmed", message: "" })).toBe("auth.error.emailNotConfirmed");
  });
  it("signale un problème réseau", () => {
    expect(authErrorKey("guest", { status: 0, code: "", message: "Failed to fetch" })).toBe("auth.error.network");
  });
});

describe("readAuthError", () => {
  it("lit une erreur Supabase", () => {
    expect(readAuthError({ name: "AuthApiError", status: 400, code: "invalid_credentials", message: "Invalid login credentials" })).toEqual({
      status: 400,
      code: "invalid_credentials",
      message: "Invalid login credentials",
    });
  });
  it("traite une erreur de connexion comme une erreur réseau", () => {
    expect(readAuthError({ name: "AuthRetryableFetchError", status: 502, message: "fetch failed" }).status).toBe(0);
  });
});
