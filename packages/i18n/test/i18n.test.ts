import { describe, expect, it } from "vitest";
import { createTranslator, directionOf } from "../src";

describe("createTranslator", () => {
  const t = createTranslator("en");
  it("trouve un texte par sa clé", () => {
    expect(t("voice.micOff")).toBe("Mic off");
  });
  it("remplace les variables", () => {
    expect(t("home.greeting", { name: "Samir" })).toBe("Welcome, Samir");
  });
  it("renvoie la clé si le texte manque", () => {
    expect(t("does.not.exist" as never)).toBe("does.not.exist");
  });
});

describe("directionOf", () => {
  it("met l'arabe de droite à gauche", () => {
    expect(directionOf("ar")).toBe("rtl");
    expect(directionOf("en")).toBe("ltr");
  });
});
