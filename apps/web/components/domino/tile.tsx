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

/** Un domino ivoire dessiné en SVG : léger, net à toutes les tailles. */
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
          <path d={`M ${px + 8.6} ${py - 3.5} A 9.3 9.3 0 0 1 ${px - 3.5} ${py + 8.6}`} fill="none" stroke="#ffe9c4" strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round" />
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
          <stop offset="0" stopColor="#fffdf6" />
          <stop offset="0.5" stopColor="#f7eedb" />
          <stop offset="1" stopColor="#e6d6b4" />
        </linearGradient>
        <linearGradient id={`edge-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9c49a" />
          <stop offset="0.6" stopColor="#a88d60" />
          <stop offset="1" stopColor="#6f5937" />
        </linearGradient>
        <radialGradient id={`gloss-${id}`} cx="0.25" cy="0.12" r="0.7">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`pip-${id}`} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#3a2a1b" />
          <stop offset="0.6" stopColor="#150d07" />
          <stop offset="1" stopColor="#050302" />
        </radialGradient>
        <radialGradient id={`pin-${id}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fbe3a2" />
          <stop offset="0.5" stopColor="#c8962f" />
          <stop offset="1" stopColor="#6e4b14" />
        </radialGradient>
      </defs>
      {/* La tranche (épaisseur), puis la face d'ivoire avec son reflet verni. */}
      <rect x="1.5" y={E} width={w - 3} height={h - E - 1.5} rx="18" fill={`url(#edge-${id})`} />
      <rect x="1.5" y="1.5" width={w - 3} height={fh} rx="18" fill={`url(#face-${id})`} stroke="#b59c6c" strokeWidth="1.6" />
      <rect x="5" y="4.5" width={w - 10} height={fh - 8} rx="14.5" fill="none" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="2.5" />
      <rect x="5" y="4.5" width={w - 10} height={fh - 8} rx="14.5" fill={`url(#gloss-${id})`} />
      {vertical ? (
        <>
          <path d={`M 16 ${cy} H ${cx - 11} M ${cx + 11} ${cy} H 84`} stroke="#7d6744" strokeWidth="3.2" strokeLinecap="round" />
          <path d={`M 16 ${cy + 2.6} H ${cx - 11} M ${cx + 11} ${cy + 2.6} H 84`} stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d={`M ${cx} 14 V ${cy - 11} M ${cx} ${cy + 11} V ${fh - 14}`} stroke="#7d6744" strokeWidth="3.2" strokeLinecap="round" />
          <path d={`M ${cx + 2.6} 14 V ${cy - 11} M ${cx + 2.6} ${cy + 11} V ${fh - 14}`} stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {/* Le clou en laiton, en relief. */}
      <circle cx={cx} cy={cy + 1.2} r="7" fill="#5b3e10" fillOpacity="0.35" />
      <circle cx={cx} cy={cy} r="6.5" fill={`url(#pin-${id})`} stroke="#6e4b14" strokeWidth="0.8" />
      <circle cx={cx - 2} cy={cy - 2.2} r="1.8" fill="#fff6d8" fillOpacity="0.9" />
      <g transform={`scale(1 ${fh / (h)})`}>
        {half(a, 0, 0)}
        {vertical ? half(b, 0, 100) : half(b, 100, 0)}
      </g>
    </svg>
  );
}

/** Le dos d'un domino des autres joueurs : laiton doré avec une étoile à huit branches. */
export function DominoBack({ size, className }: { size: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 200" width={size} height={size * 2} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`back-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6d98c" />
          <stop offset="0.5" stopColor="#d4a446" />
          <stop offset="1" stopColor="#a8762a" />
        </linearGradient>
      </defs>
      <rect x="2" y="8" width="96" height="190" rx="16" fill="#6e4b18" />
      <rect x="2" y="2" width="96" height="188" rx="16" fill={`url(#back-${id})`} stroke="#8a5f1d" strokeWidth="3" />
      <rect x="12" y="12" width="76" height="168" rx="10" fill="none" stroke="#fff3cf" strokeOpacity="0.6" strokeWidth="3" />
      <g transform="translate(50 96)" fill="none" stroke="#7a5216" strokeWidth="5" strokeOpacity="0.75">
        <rect x="-20" y="-20" width="40" height="40" />
        <rect x="-20" y="-20" width="40" height="40" transform="rotate(45)" />
      </g>
    </svg>
  );
}
