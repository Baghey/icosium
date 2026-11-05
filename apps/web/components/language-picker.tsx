"use client";

import { LOCALES } from "@icosium/i18n";
import { useI18n } from "@/lib/i18n";

/** Choix de la langue de l'interface. */
export function LanguagePicker() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div role="group" aria-label={t("common.language")} className="flex gap-1 rounded-control bg-surface-2 p-1">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
          className={`min-h-touch flex-1 rounded-[calc(var(--radius-control)-0.25rem)] px-3 text-sm font-medium transition-colors duration-200 ${
            locale === code ? "bg-surface text-ink shadow-sm" : "text-ink-muted"
          }`}
        >
          {t(`language.${code}`)}
        </button>
      ))}
    </div>
  );
}
