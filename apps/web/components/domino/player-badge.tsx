"use client";

import { MicIcon, MicOffIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { BotIcon, TileBackIcon } from "@/components/cafe-icons";
import { DEFAULT_AVATARS, avatarIndex } from "@/lib/avatar";

export type PlayerInfo = {
  name: string | null;
  userId: string | null;
  avatar: string | null;
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
  bot?: boolean;
};

/** Couleur de fond de l'avatar, toujours la même pour une personne. */
function hueOf(id: string | null): number {
  let h = 0;
  for (const c of id ?? "?") h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** Un avatar par personne, toujours le même, et jamais deux fois le même à une table. */
export function tableAvatars(userIds: string[]): Record<string, string> {
  const taken = new Set<number>();
  const out: Record<string, string> = {};
  for (const id of userIds) {
    let i = avatarIndex(id);
    while (taken.has(i) && taken.size < DEFAULT_AVATARS.length) i = (i + 1) % DEFAULT_AVATARS.length;
    taken.add(i);
    out[id] = `/assets/avatars/${DEFAULT_AVATARS[i]}.webp`;
  }
  return out;
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
        {p.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatar} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-gilded drop-shadow">{initial}</span>
        )}
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

/**
 * Un adversaire ou le partenaire, dans la rangée au-dessus de la table (jamais posé dessus) :
 * avatar, nombre de pierres en pastille dorée, et nom.
 */
export function PlayerBadge({ p, size = 48 }: { p: PlayerInfo; size?: number }) {
  const t = useT();
  return (
    <div className="flex w-[6.75rem] flex-col items-center gap-1">
      <div className="relative">
        <Avatar p={p} size={size} />
        <span
          key={p.count}
          className="animate-pop absolute -start-2.5 -bottom-1 flex items-center gap-0.5 rounded-full bg-cafe-0/90 py-0.5 ps-1 pe-1.5 text-[11px] leading-none font-bold text-gold-light shadow-[0_2px_6px_rgba(0,0,0,0.5)] ring-1 ring-gold/60"
          aria-label={t("domino.tiles", { n: p.count })}
        >
          <TileBackIcon className="h-3.5 w-2.5" />
          {p.count}
        </span>
      </div>
      <span
        className={`flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-tight font-semibold ${
          p.active ? "bg-gold/90 text-cafe-0" : "bg-black/45 text-cafe-text ring-1 ring-gold/25"
        } transition-colors duration-200`}
      >
        {p.bot && <BotIcon className="size-3 shrink-0" />}
        <span className="truncate">{p.name ?? t("domino.freeSeat")}</span>
      </span>
    </div>
  );
}
