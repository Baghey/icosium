import en from "./locales/en.json";
import fr from "./locales/fr.json";

/** Langues livrées. L'arabe s'ajoutera ici (le sens droite-à-gauche est déjà prévu). */
export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Sens d'écriture de chaque langue prévue (l'arabe sera "rtl"). */
const DIRECTIONS: Record<string, "ltr" | "rtl"> = { en: "ltr", fr: "ltr", ar: "rtl" };

export function directionOf(locale: string): "ltr" | "rtl" {
  return DIRECTIONS[locale] ?? "ltr";
}

export type Messages = typeof en;

const CATALOG: Record<Locale, Messages> = { en, fr };

export function isLocale(value: string | null | undefined): value is Locale {
  return (LOCALES as readonly string[]).includes(value ?? "");
}

/** Choisit la langue à partir des langues préférées du navigateur (ex. ["fr-DZ", "ar"]). */
export function pickLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** Toutes les clés possibles, sous la forme "voice.micOn". */
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Leaves<Messages>;

function lookup(messages: unknown, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Crée la fonction de traduction pour une langue. Les {variables} sont remplacées. */
export function createTranslator(locale: Locale = DEFAULT_LOCALE) {
  const messages = CATALOG[locale];
  return function t(key: MessageKey, vars?: Record<string, string | number>): string {
    const text = lookup(messages, key) ?? lookup(CATALOG[DEFAULT_LOCALE], key) ?? key;
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
      name in vars ? String(vars[name]) : whole,
    );
  };
}

export type Translator = ReturnType<typeof createTranslator>;
