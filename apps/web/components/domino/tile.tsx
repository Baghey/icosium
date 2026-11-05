"use client";

import { useId } from "react";

/** Positions des points dans une moitié de domino (carré 100 × 100). */
const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 24], [73, 24], [27, 50], [73, 50], [27, 76], [73, 76]],
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
      const px = vertical ? x : y;
      const py = vertical ? y : 100 - x;
      return <circle key={`${dx}-${dy}-${i}`} cx={dx + px} cy={dy + py} r={10} fill={`url(#pip-${id})`} />;
    });

  // Le domino a une épaisseur : la face est un peu plus courte, la tranche dépasse en bas.
  const E = 9;
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
        <linearGradient id={`face-${id}`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.45" stopColor="#f5ead2" />
          <stop offset="1" stopColor="#e3d2ad" />
        </linearGradient>
        <linearGradient id={`edge-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cdb68a" />
          <stop offset="1" stopColor="#8f7650" />
        </linearGradient>
        <radialGradient id={`pip-${id}`} cx="0.62" cy="0.68" r="0.75">
          <stop offset="0" stopColor="#5a4632" />
          <stop offset="0.55" stopColor="#231910" />
          <stop offset="1" stopColor="#0d0805" />
        </radialGradient>
        <radialGradient id={`pin-${id}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fbe3a2" />
          <stop offset="0.5" stopColor="#c8962f" />
          <stop offset="1" stopColor="#6e4b14" />
        </radialGradient>
      </defs>
      <rect x="1.5" y={E} width={w - 3} height={h - E - 1.5} rx="17" fill={`url(#edge-${id})`} />
      <rect x="1.5" y="1.5" width={w - 3} height={fh} rx="17" fill={`url(#face-${id})`} stroke="#b9a274" strokeWidth="2" />
      <rect x="6" y="5" width={w - 12} height={fh - 9} rx="13" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="2.5" />
      {vertical ? (
        <>
          <line x1="14" y1={cy} x2="86" y2={cy} stroke="#8f7a55" strokeWidth="3" strokeLinecap="round" />
          <line x1="14" y1={cy + 2.5} x2="86" y2={cy + 2.5} stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <line x1={cx} y1="12" x2={cx} y2={fh - 12} stroke="#8f7a55" strokeWidth="3" strokeLinecap="round" />
          <line x1={cx + 2.5} y1="12" x2={cx + 2.5} y2={fh - 12} stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      <circle cx={cx} cy={cy} r="5.5" fill={`url(#pin-${id})`} stroke="#5b3e10" strokeWidth="0.8" />
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
