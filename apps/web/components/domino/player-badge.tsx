"use client";

import { MicIcon, MicOffIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { DominoBack } from "./tile";

export type PlayerInfo = {
  name: string | null;
  userId: string | null;
  /** Points de son équipe. */
  score: number;
  count: number;
  active: boolean;
  /** Part du temps restant (1 → 0), ou null si pas de chrono. */
  timeLeft: number | null;
  bubble: string | null;
  inVoice: boolean;
  micOn: boolean;
  speaking: boolean;
  partner?: boolean;
  me?: boolean;
};

/** Couleur de fond de l'avatar, toujours la même pour une personne. */
function hueOf(id: string | null): number {
  let h = 0;
  for (const c of id ?? "?") h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** L'avatar rond : anneau doré quand c'est son tour, vert quand il parle, badge micro. */
export function Avatar({ p, size }: { p: PlayerInfo; size: number }) {
  const t = useT();
  const initial = p.name?.trim().charAt(0).toUpperCase() || "?";
  const hue = hueOf(p.userId);
  const R = 46;
  const C = 2 * Math.PI * R;
  const ring = p.speaking ? "animate-speak" : p.active ? "animate-turn" : "";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className={`absolute inset-0 flex items-center justify-center overflow-hidden rounded-full border-2 border-gold/70 font-semibold ${ring}`}
        style={{
          background: `radial-gradient(circle at 35% 30%, hsl(${hue} 35% 42%), hsl(${hue} 40% 18%))`,
          fontSize: size * 0.42,
        }}
      >
        <span className="text-gilded drop-shadow">{initial}</span>
      </div>
      {p.active && p.timeLeft !== null && (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute -inset-[4px] -rotate-90" style={{ width: size + 8, height: size + 8 }} aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="var(--gold-light)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - Math.max(0, Math.min(1, p.timeLeft)))}
            className="transition-[stroke-dashoffset] duration-300 ease-linear"
          />
        </svg>
      )}
      {p.inVoice && (
        <span
          className={`absolute -end-1 -bottom-1 flex items-center justify-center rounded-full border-2 border-cafe-0 ${p.micOn ? "bg-mic-on text-white" : "bg-cafe-2 text-cafe-muted"}`}
          style={{ width: size * 0.4, height: size * 0.4 }}
          aria-label={p.micOn ? t("voice.micOn") : t("voice.micOff")}
        >
          {p.micOn ? <MicIcon className="size-[60%]" /> : <MicOffIcon className="size-[60%]" />}
        </span>
      )}
      {p.bubble && (
        <span className="animate-bubble absolute -top-3 start-1/2 z-10 -translate-x-1/2 rounded-full bg-gold px-2 py-0.5 text-xs font-bold whitespace-nowrap text-cafe-0 shadow-lg rtl:translate-x-1/2">
          {p.bubble}
        </span>
      )}
    </div>
  );
}

/** Un adversaire ou le partenaire autour de la table : avatar, nom, points et dominos restants. */
export function PlayerBadge({ p, size = 52 }: { p: PlayerInfo; size?: number }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-1">
      <Avatar p={p} size={size} />
      <div className="cafe-panel flex max-w-[7.5rem] flex-col items-center rounded-xl px-2.5 py-0.5 leading-tight">
        <span className="max-w-full truncate text-xs font-semibold text-cafe-text">{p.name ?? t("domino.freeSeat")}</span>
        <span className="text-[11px] text-cafe-muted">{t("domino.pts", { n: p.score })}</span>
      </div>
      <span className="flex items-center gap-[2px]" aria-label={t("domino.tiles", { n: p.count })}>
        {Array.from({ length: Math.min(p.count, 7) }, (_, i) => (
          <DominoBack key={i} size={7} />
        ))}
        {p.count > 7 && <span className="ms-0.5 text-[10px] font-semibold text-gold-light">+{p.count - 7}</span>}
      </span>
    </div>
  );
}
