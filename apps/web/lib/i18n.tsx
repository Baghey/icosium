"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, createTranslator, directionOf, type Locale, type Translator } from "@icosium/i18n";

type I18nValue = { locale: Locale; dir: "ltr" | "rtl"; t: Translator };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale = DEFAULT_LOCALE, children }: { locale?: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, dir: directionOf(locale), t: createTranslator(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

export function useT(): Translator {
  return useI18n().t;
}
