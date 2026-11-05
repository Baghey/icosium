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

import en from "../src/locales/en.json";
import fr from "../src/locales/fr.json";
import { pickLocale } from "../src";

function keys(node: unknown, prefix = ""): string[] {
  if (typeof node !== "object" || node === null) return [prefix];
  return Object.entries(node).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe("français", () => {
  it("a exactement les mêmes clés que l'anglais", () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });
  it("traduit avec les variables", () => {
    expect(createTranslator("fr")("voice.isSpeaking", { name: "Amine" })).toBe("Amine parle");
  });
});

describe("pickLocale", () => {
  it("prend la première langue disponible du navigateur", () => {
    expect(pickLocale(["fr-DZ", "en"])).toBe("fr");
    expect(pickLocale(["ar-DZ", "en-US"])).toBe("en");
    expect(pickLocale(["de"])).toBe("en");
  });
});
