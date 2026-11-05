"use client";

import { useId } from "react";

/** Positions des points dans une moitié de domino (carré 100 × 100). */
const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[26, 21], [74, 21], [26, 50], [74, 50], [26, 79], [74, 79]],
};

export type TileProps = {
  /** Valeur de la première moitié (en haut, ou à gauche). */
  a: number;
  /** Valeur de la seconde moitié (en bas, ou à droite). */
  b: number;
  orientation?: "vertical" | "horizontal";
  /** Taille du petit côté, en pixels. */
  size: number;
  className?: string;
  title?: string;
};

/** Un domino en plastique blanc à points noirs, dessiné en SVG : léger, net à toutes les tailles. */
export function DominoTile({ a, b, orientation = "vertical", size, className, title }: TileProps) {
  const id = useId().replace(/:/g, "");
  const vertical = orientation === "vertical";
  const w = vertical ? 100 : 200;
  const h = vertical ? 200 : 100;
  const half = (value: number, dx: number, dy: number) =>
    (PIPS[value] ?? []).map(([x, y], i) => {
      // À l'horizontale, on tourne les points d'un quart de tour pour garder le dessin classique.
      const px = dx + (vertical ? x : y);
      const py = dy + (vertical ? y : 100 - x);
      // Un point creusé : fond noir brillant, paroi éclairée en bas à droite, rebord clair.
      return (
        <g key={`${dx}-${dy}-${i}`}>
          <circle cx={px} cy={py} r={12.5} fill="#ffffff" fillOpacity="0.75" transform="translate(0.8 1.2)" />
          <circle cx={px} cy={py} r={12} fill={`url(#pip-${id})`} />
          <path d={`M ${px + 8.6} ${py - 3.5} A 9.3 9.3 0 0 1 ${px - 3.5} ${py + 8.6}`} fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    });

  // Le domino a une épaisseur : la face est un peu plus courte, la tranche dépasse en bas.
  const E = 12;
  const fh = h - E;
  const cx = vertical ? 50 : 100;
  const cy = vertical ? fh / 2 : fh / 2;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={vertical ? size : size * 2}
      height={vertical ? size * 2 : size}
      className={className}
      role="img"
      aria-label={title ?? `${a}-${b}`}
    >
      <defs>
        <linearGradient id={`face-${id}`} x1="0" y1="0" x2="0.55" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#f6f6f3" />
          <stop offset="1" stopColor="#e3e3df" />
        </linearGradient>
        <linearGradient id={`edge-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d6d6d1" />
          <stop offset="0.6" stopColor="#a9a9a4" />
          <stop offset="1" stopColor="#6e6e6a" />
        </linearGradient>
        <radialGradient id={`gloss-${id}`} cx="0.25" cy="0.12" r="0.7">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`pip-${id}`} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#2e2e33" />
          <stop offset="0.6" stopColor="#0f0f12" />
          <stop offset="1" stopColor="#030304" />
        </radialGradient>
      </defs>
      {/* La tranche (épaisseur), puis la face en plastique blanc avec son reflet. */}
      <rect x="1.5" y={E} width={w - 3} height={h - E - 1.5} rx="18" fill={`url(#edge-${id})`} />
      <rect x="1.5" y="1.5" width={w - 3} height={fh} rx="18" fill={`url(#face-${id})`} stroke="#b8b8b2" strokeWidth="1.6" />
      <rect x="5" y="4.5" width={w - 10} height={fh - 8} rx="14.5" fill="none" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="2.5" />
      <rect x="5" y="4.5" width={w - 10} height={fh - 8} rx="14.5" fill={`url(#gloss-${id})`} />
      {vertical ? (
        <>
          <path d={`M 16 ${cy} H 84`} stroke="#55555a" strokeWidth="3.2" strokeLinecap="round" />
          <path d={`M 16 ${cy + 2.6} H 84`} stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d={`M ${cx} 14 V ${fh - 14}`} stroke="#55555a" strokeWidth="3.2" strokeLinecap="round" />
          <path d={`M ${cx + 2.6} 14 V ${fh - 14}`} stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      <g transform={`scale(1 ${fh / (h)})`}>
        {half(a, 0, 0)}
        {vertical ? half(b, 0, 100) : half(b, 100, 0)}
      </g>
    </svg>
  );
}

/** Le dos d'un domino des autres joueurs : plastique blanc, une étoile à huit branches moulée. */
export function DominoBack({ size, className }: { size: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 200" width={size} height={size * 2} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`back-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#ecece8" />
          <stop offset="1" stopColor="#cfcfca" />
        </linearGradient>
      </defs>
      <rect x="2" y="8" width="96" height="190" rx="16" fill="#8a8a85" />
      <rect x="2" y="2" width="96" height="188" rx="16" fill={`url(#back-${id})`} stroke="#a5a5a0" strokeWidth="3" />
      <rect x="12" y="12" width="76" height="168" rx="10" fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="3" />
      <g transform="translate(50 96)" fill="none" stroke="#9a9a95" strokeWidth="5" strokeOpacity="0.7">
        <rect x="-20" y="-20" width="40" height="40" />
        <rect x="-20" y="-20" width="40" height="40" transform="rotate(45)" />
      </g>
    </svg>
  );
}
