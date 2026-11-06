"use client";

import type { RondaCard } from "@icosium/shared";
import type { CSSProperties } from "react";
import { useId } from "react";

/** Proportions des cartes (Vector Playing Cards : 167 × 243). */
export const CARD_RATIO = 1.452;

type Props = {
  card?: RondaCard | null;
  /** Largeur en px ; la hauteur suit. */
  width: number;
  faceDown?: boolean;
  /** Anneau doré : carte qu'on peut toucher, carte prise, carte à montrer. */
  glow?: boolean;
  dim?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Une carte de la Ronda : la vraie face (jeu français classique, domaine public) sur un carton
 * ivoire, ou notre dos ICOSIUM (zellige doré sur feutre vert). Ombre portée et léger relief.
 */
export function PlayingCard({ card, width, faceDown, glow, dim, label, className = "", style }: Props) {
  const height = Math.round(width * CARD_RATIO);
  const radius = Math.max(3, Math.round(width * 0.07));
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
    >
      {faceDown || !card ? (
        <CardBack width={width} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/cards/${card}.webp`}
          alt=""
          draggable={false}
          width={width}
          height={height}
          className="block size-full select-none"
          style={{
            borderRadius: radius,
            background: "#fbf4e4",
            boxShadow: "0 1px 0 rgb(255 255 255 / 0.6) inset, 0 0 0 0.5px rgb(90 60 30 / 0.45), 0 3px 6px rgb(0 0 0 / 0.45), 0 10px 18px rgb(0 0 0 / 0.28)",
            filter: dim ? "brightness(0.6) saturate(0.7)" : undefined,
          }}
        />
      )}
      {glow && (
        <span
          className="animate-glow pointer-events-none absolute -inset-[3px]"
          style={{ borderRadius: radius + 3, boxShadow: "0 0 0 2px var(--gold-light), 0 0 16px 4px color-mix(in srgb, var(--gold) 70%, transparent)" }}
          aria-hidden="true"
        />
      )}
    </span>
  );
}

/** Le dos ICOSIUM : feutre vert, filet doré, zellige en étoiles, rosace au centre. */
export function CardBack({ width }: { width: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 145" width={width} height={Math.round(width * CARD_RATIO)} className="block drop-shadow-[0_3px_5px_rgb(0_0_0/0.55)]" aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3dca0" />
          <stop offset=".5" stopColor="#b8863b" />
          <stop offset="1" stopColor="#f6e2a8" />
        </linearGradient>
        <radialGradient id={`f${id}`} cx=".5" cy=".42" r=".8">
          <stop offset="0" stopColor="#1a5a40" />
          <stop offset="1" stopColor="#0b2a1e" />
        </radialGradient>
        <pattern id={`z${id}`} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M8 1l2.1 4.9L15 8l-4.9 2.1L8 15l-2.1-4.9L1 8l4.9-2.1z" fill="none" stroke="#f3dca0" strokeWidth=".7" opacity=".5" />
        </pattern>
      </defs>
      <rect x="1" y="1" width="98" height="143" rx="7" fill={`url(#f${id})`} stroke={`url(#g${id})`} strokeWidth="2" />
      <rect x="7" y="7" width="86" height="131" rx="4" fill={`url(#z${id})`} stroke={`url(#g${id})`} strokeWidth="1.2" />
      <circle cx="50" cy="72.5" r="17" fill="#0c261c" stroke={`url(#g${id})`} strokeWidth="2.4" />
      <path d="M50 59l3.8 9.7 9.7 3.8-9.7 3.8L50 86l-3.8-9.7-9.7-3.8 9.7-3.8z" fill={`url(#g${id})`} />
    </svg>
  );
}
