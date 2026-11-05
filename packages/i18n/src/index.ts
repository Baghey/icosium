import en from "./locales/en.json";

/** Langues prévues. Seul l'anglais est livré au lancement ; fr et ar s'ajoutent ici. */
export const LOCALES = ["en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Sens d'écriture de chaque langue prévue (l'arabe sera "rtl"). */
const DIRECTIONS: Record<string, "ltr" | "rtl"> = { en: "ltr", fr: "ltr", ar: "rtl" };

export function directionOf(locale: string): "ltr" | "rtl" {
  return DIRECTIONS[locale] ?? "ltr";
}

export type Messages = typeof en;

const CATALOG: Record<Locale, Messages> = { en };

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
