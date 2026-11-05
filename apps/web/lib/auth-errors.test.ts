import { describe, expect, it } from "vitest";
import { authErrorKey, readNakamaError } from "./auth-errors";

describe("authErrorKey", () => {
  it("reconnaît le refus d'âge du serveur", () => {
    expect(authErrorKey("signUp", { status: 400, message: "too_young" })).toBe("auth.error.tooYoung");
  });
  it("distingue mauvais identifiants et email déjà pris", () => {
    expect(authErrorKey("signIn", { status: 401, message: "Invalid credentials." })).toBe("auth.error.badCredentials");
    expect(authErrorKey("signUp", { status: 401, message: "Invalid credentials." })).toBe("auth.error.emailTaken");
  });
  it("signale un pseudo déjà pris", () => {
    expect(authErrorKey("signUp", { status: 409, message: "Username is already in use." })).toBe("auth.error.usernameTaken");
  });
  it("signale un problème réseau", () => {
    expect(authErrorKey("guest", { status: 0, message: "Failed to fetch" })).toBe("auth.error.network");
  });
});

describe("readNakamaError", () => {
  it("lit le message d'une réponse Nakama", async () => {
    const res = new Response(JSON.stringify({ code: 3, message: "too_young" }), { status: 400 });
    expect(await readNakamaError(res)).toEqual({ status: 400, message: "too_young" });
  });
  it("traite une exception comme une erreur réseau", async () => {
    expect(await readNakamaError(new TypeError("Failed to fetch"))).toEqual({ status: 0, message: "Failed to fetch" });
  });
});
