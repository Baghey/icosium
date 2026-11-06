"use client";

import type { MessageKey } from "@icosium/i18n";
import { Sheet } from "@/components/sheet";
import { useT } from "@/lib/i18n";
import { DieFace } from "./die";

const LINES: MessageKey[] = ["ludo.rules.r1", "ludo.rules.r2", "ludo.rules.r3", "ludo.rules.r4", "ludo.rules.r5", "ludo.rules.r6", "ludo.rules.r7"];

/** Le résumé des règles, lisible à tout moment pendant une partie (bouton « Règles »). */
export function LudoRulesSheet({ pawnsToWin, onClose, learnHref }: { pawnsToWin: number; onClose: () => void; learnHref?: string }) {
  const t = useT();
  return (
    <Sheet onClose={onClose} label={t("ludo.rules.title")}>
      <div className="flex items-center gap-3">
        <DieFace value={6} size={34} />
        <h2 className="text-gilded text-xl font-bold">{t("ludo.rules.title")}</h2>
      </div>
      <ol className="mt-4 flex list-none flex-col gap-2.5 text-sm text-cafe-text">
        {[...LINES.map((k) => t(k)), t("ludo.rules.r8", { n: pawnsToWin })].map((line, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-gold/60 text-[11px] font-bold text-gold-light">{i + 1}</span>
            <span>{line}</span>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex gap-2">
        {learnHref && (
          <a href={learnHref} className="cafe-panel flex min-h-touch flex-1 items-center justify-center rounded-control px-3 text-sm font-semibold text-gold-light">
            {t("ludo.learn.button")}
          </a>
        )}
        <button type="button" onClick={onClose} className="gold-button min-h-touch flex-1 rounded-control px-4 font-bold">
          {t("ludo.rules.close")}
        </button>
      </div>
    </Sheet>
  );
}

export function RulesButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("ludo.rules.open")}
      className="flex size-touch shrink-0 items-center justify-center rounded-full border border-gold/60 text-lg font-bold text-gold-light"
      style={{ background: "rgb(22 14 9 / 0.85)" }}
    >
      ?
    </button>
  );
}
