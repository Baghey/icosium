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
      return <circle key={`${dx}-${dy}-${i}`} cx={dx + px} cy={dy + py} r={9.5} fill={`url(#pip-${id})`} />;
    });

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
        <linearGradient id={`ivory-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffdf6" />
          <stop offset="0.55" stopColor="#f6eedc" />
          <stop offset="1" stopColor="#e6d8bb" />
        </linearGradient>
        <radialGradient id={`pip-${id}`} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#4a3a2c" />
          <stop offset="1" stopColor="#1d140d" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width={w - 4} height={h - 4} rx="16" fill={`url(#ivory-${id})`} stroke="#cbb994" strokeWidth="3" />
      <rect x="7" y="7" width={w - 14} height={h - 14} rx="12" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2" />
      {vertical ? (
        <line x1="16" y1="100" x2="84" y2="100" stroke="#b9a57e" strokeWidth="3" strokeLinecap="round" />
      ) : (
        <line x1="100" y1="16" x2="100" y2="84" stroke="#b9a57e" strokeWidth="3" strokeLinecap="round" />
      )}
      <circle cx={vertical ? 50 : 100} cy={vertical ? 100 : 50} r="4.5" fill="#b08d4f" />
      {half(a, 0, 0)}
      {vertical ? half(b, 0, 100) : half(b, 100, 0)}
    </svg>
  );
}

/** Le dos d'un domino, pour les mains des autres joueurs. */
export function DominoBack({ size, className }: { size: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 200" width={size} height={size * 2} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`back-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3f8f72" />
          <stop offset="1" stopColor="#235c48" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="96" height="196" rx="16" fill={`url(#back-${id})`} stroke="#1b4637" strokeWidth="3" />
      <rect x="14" y="14" width="72" height="172" rx="10" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="3" />
      <path d="M50 78 L66 100 L50 122 L34 100 Z" fill="#ffffff" fillOpacity="0.55" />
    </svg>
  );
}
