"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  createTranslator,
  directionOf,
  isLocale,
  pickLocale,
  type Locale,
  type Translator,
} from "@icosium/i18n";

type I18nValue = { locale: Locale; dir: "ltr" | "rtl"; t: Translator; setLocale: (locale: Locale) => void };

const I18nContext = createContext<I18nValue | null>(null);
const STORAGE_KEY = "icosium.locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Langue choisie par la personne, sinon celle du téléphone.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // stockage indisponible
    }
    setLocaleState(isLocale(saved) ? saved : pickLocale(navigator.languages ?? [navigator.language]));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = directionOf(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // stockage indisponible : le choix vaut pour cette visite
    }
  }, []);

  const value = useMemo(
    () => ({ locale, dir: directionOf(locale), t: createTranslator(locale), setLocale }),
    [locale, setLocale],
  );
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
