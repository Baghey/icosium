"use client";

import type { LudoColor } from "@icosium/shared";
import { BotIcon } from "@/components/cafe-icons";
import { MicIcon, MicOffIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { LUDO_FILL } from "./board";
import { RollingDie } from "./die";

export type LudoPlayer = {
  name: string;
  color: LudoColor;
  avatar: string | null;
  active: boolean;
  /** Part du temps restant (1 → 0), ou null sans chrono. */
  timeLeft: number | null;
  inVoice: boolean;
  micOn: boolean;
  speaking: boolean;
  finished: number;
  pawnsToWin: number;
  die: { value: number; key: number } | null;
  bot: boolean;
  partner: boolean;
  bubble: string | null;
};

/**
 * Un joueur dans son coin, comme sur la maquette validée : panneau sombre bordé d'or, avatar rond
 * cerclé de sa couleur (l'anneau se vide avec le chrono), badge micro, pastilles des pions rentrés
 * et son dernier dé.
 */
export function PlayerPanel({ p, align }: { p: LudoPlayer | null; align: "start" | "end" }) {
  const t = useT();
  if (!p) {
    return <div className="h-[3.6rem] flex-1 rounded-[0.9rem] border border-dashed border-gold/15" aria-hidden="true" />;
  }
  const fill = LUDO_FILL[p.color];
  const ring = p.timeLeft === null ? 100 : Math.max(0, Math.min(1, p.timeLeft)) * 100;
  return (
    <div
      className={`relative flex h-[3.6rem] min-w-0 flex-1 items-center gap-2 rounded-[0.9rem] px-2 transition-[box-shadow,border-color] duration-200 ${align === "end" ? "flex-row-reverse text-end" : ""} ${
        p.active ? "border border-gold-light shadow-[0_0_0_1px_var(--gold),0_0_18px_rgb(216_167_72/0.45)]" : "border border-gold/50"
      }`}
      style={{ background: "linear-gradient(180deg, rgb(40 26 16 / 0.92), rgb(22 14 9 / 0.86))" }}
    >
      <div className="relative size-11 shrink-0">
        <div
          className={`size-full rounded-full p-[3px] ${p.speaking ? "animate-speak" : ""}`}
          style={{ background: `conic-gradient(${fill.main} ${ring}%, rgb(255 255 255 / 0.12) 0)` }}
        >
          <div className="size-full overflow-hidden rounded-full" style={{ background: `radial-gradient(circle at 50% 30%, ${fill.main}, ${fill.dark})` }}>
            {p.avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.avatar} alt="" className="size-full object-cover" />
            )}
          </div>
        </div>
        {p.inVoice && (
          <span
            className={`absolute -end-1 -bottom-1 flex size-[1.15rem] items-center justify-center rounded-full border ${p.micOn ? "border-[#bff0d2] bg-mic-on text-white" : "border-gold bg-cafe-1 text-gold"}`}
            aria-label={p.micOn ? t("voice.micOn") : t("voice.micOff")}
          >
            {p.micOn ? <MicIcon className="size-2.5" /> : <MicOffIcon className="size-2.5" />}
          </span>
        )}
        {p.bot && (
          <span className="absolute -start-1 -bottom-1 flex size-[1.15rem] items-center justify-center rounded-full border border-gold/60 bg-cafe-1 text-gold-light">
            <BotIcon className="size-3" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13px] font-semibold text-gold-light">{p.name}</p>
        {p.partner && <p className="truncate text-[10px] text-cafe-muted">{t("ludo.partner")}</p>}
        <div className={`mt-1 flex gap-[3px] ${align === "end" ? "justify-end" : ""}`} aria-label={t("ludo.finished", { n: p.finished, total: p.pawnsToWin })}>
          {Array.from({ length: p.pawnsToWin }, (_, i) => (
            <i key={i} className="block size-[7px] rounded-full border" style={{ borderColor: fill.main, background: i < p.finished ? fill.main : "transparent" }} />
          ))}
        </div>
      </div>
      {p.die && (
        <span className={`shrink-0 transition-opacity duration-200 ${p.active ? "opacity-100" : "opacity-45"}`}>
          <RollingDie value={p.die.value} rollKey={p.die.key} size={30} />
        </span>
      )}
      {p.bubble && (
        <span
          key={p.bubble}
          className={`animate-bubble pointer-events-none absolute -top-3 z-20 rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-cafe-0 shadow-lg ${align === "end" ? "end-3" : "start-3"}`}
        >
          {p.bubble}
        </span>
      )}
    </div>
  );
}
