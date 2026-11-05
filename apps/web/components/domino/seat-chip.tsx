"use client";

import { useT } from "@/lib/i18n";
import { DominoBack } from "./tile";

type Props = {
  name: string | null;
  count: number;
  active: boolean;
  /** Part du temps restant (1 → 0), ou null si pas de chrono. */
  timeLeft: number | null;
  bubble: string | null;
  partner?: boolean;
};

/** Un autre joueur autour de la table : avatar, nombre de dominos, « joue » et bulles (passe, pioche). */
export function SeatChip({ name, count, active, timeLeft, bubble, partner }: Props) {
  const t = useT();
  const initial = name?.trim().charAt(0).toUpperCase() || "?";
  const R = 23;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative flex min-w-0 flex-col items-center gap-1">
      <div className="relative size-14">
        <svg viewBox="0 0 52 52" className="absolute inset-0 size-14 -rotate-90" aria-hidden="true">
          <circle cx="26" cy="26" r={R} fill="none" stroke="var(--icos-line)" strokeWidth="3" />
          {active && (
            <circle
              cx="26"
              cy="26"
              r={R}
              fill="none"
              stroke="var(--icos-mint)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={timeLeft === null ? 0 : C * (1 - Math.max(0, Math.min(1, timeLeft)))}
              className="transition-[stroke-dashoffset] duration-300 ease-linear"
            />
          )}
        </svg>
        <div
          className={`absolute inset-[5px] flex items-center justify-center rounded-full text-lg font-semibold transition-colors duration-200 ${
            active ? "bg-mint text-mint-ink" : partner ? "bg-mint-soft text-ink" : "bg-surface-2 text-ink"
          }`}
        >
          {initial}
        </div>
        {bubble && (
          <span className="animate-bubble absolute -top-2 start-1/2 z-10 -translate-x-1/2 rounded-full bg-ink px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-bg rtl:translate-x-1/2">
            {bubble}
          </span>
        )}
      </div>
      <span className="max-w-[6.5rem] truncate text-xs font-medium">{name ?? t("domino.freeSeat")}</span>
      <span className="flex items-center gap-0.5" aria-label={t("domino.tiles", { n: count })}>
        {Array.from({ length: Math.min(count, 7) }, (_, i) => (
          <DominoBack key={i} size={6} />
        ))}
        {count > 7 && <span className="ms-0.5 text-[10px] text-ink-muted">+{count - 7}</span>}
      </span>
    </div>
  );
}
