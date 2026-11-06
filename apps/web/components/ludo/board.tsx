"use client";

import { type LudoColor, SAFE_TRACK_INDEXES, START_INDEX } from "@icosium/shared";
import { memo, type PointerEvent, useMemo, useRef } from "react";
import { BASE_ORIGIN, BASE_SLOTS, HOME_COLUMN, type Point, TRACK, pawnPoint, rotatePoint } from "@/lib/ludo-geometry";

/** Taille d'une case en unités SVG ; le plateau fait 15 cases, plus un cadre en noyer. */
export const CELL = 24;
const SIZE = 15 * CELL;
const FRAME = 14;

export const LUDO_FILL: Record<LudoColor, { main: string; dark: string }> = {
  red: { main: "var(--ludo-red)", dark: "var(--ludo-red-dark)" },
  green: { main: "var(--ludo-green)", dark: "var(--ludo-green-dark)" },
  yellow: { main: "var(--ludo-yellow)", dark: "var(--ludo-yellow-dark)" },
  blue: { main: "var(--ludo-blue)", dark: "var(--ludo-blue-dark)" },
};
const COLORS: LudoColor[] = ["red", "green", "yellow", "blue"];

export function starPoints(x: number, y: number, R: number, inner: number, n = 8): string {
  let p = "";
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI / n) * i - Math.PI / 2;
    const r = i % 2 ? R * inner : R;
    p += `${(x + r * Math.cos(a)).toFixed(2)},${(y + r * Math.sin(a)).toFixed(2)} `;
  }
  return p.trim();
}

/** Les dégradés partagés : noyer, ivoire, laiton, émail de chaque couleur, zellige. */
function Defs() {
  return (
    <defs>
      <linearGradient id="lb-walnut" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7a4b2c" />
        <stop offset=".45" stopColor="#43281a" />
        <stop offset="1" stopColor="#22130b" />
      </linearGradient>
      <pattern id="lb-grain" width="40" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
        <path d="M0 3 Q10 1 20 3 T40 3" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="1" />
      </pattern>
      <radialGradient id="lb-ivory" cx=".45" cy=".4" r=".85">
        <stop offset="0" style={{ stopColor: "var(--ludo-ivory)" }} />
        <stop offset="1" style={{ stopColor: "var(--ludo-ivory-dark)" }} />
      </radialGradient>
      <linearGradient id="lb-brass" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#6b4e1f" />
        <stop offset=".3" style={{ stopColor: "var(--ludo-brass-light)" }} />
        <stop offset=".55" style={{ stopColor: "var(--ludo-brass)" }} />
        <stop offset="1" style={{ stopColor: "var(--ludo-brass-dark)" }} />
      </linearGradient>
      <linearGradient id="lb-brassV" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: "var(--ludo-brass-light)" }} />
        <stop offset="1" stopColor="#8a6a33" />
      </linearGradient>
      <pattern id="lb-zellige" width="16" height="16" patternUnits="userSpaceOnUse">
        <polygon points={starPoints(8, 8, 7, 0.55)} fill="none" stroke="rgba(255,236,190,.22)" strokeWidth=".7" />
        <circle cx="8" cy="8" r="1.4" fill="rgba(255,236,190,.18)" />
      </pattern>
      <filter id="lb-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.4" floodColor="#1a0f08" floodOpacity=".55" />
      </filter>
      {COLORS.map((c) => (
        <g key={c}>
          <radialGradient id={`lb-enamel-${c}`} cx=".34" cy=".3" r=".8">
            <stop offset="0" stopColor="#fff" stopOpacity=".9" />
            <stop offset=".18" style={{ stopColor: LUDO_FILL[c].main }} />
            <stop offset=".85" style={{ stopColor: LUDO_FILL[c].dark }} />
          </radialGradient>
          <linearGradient id={`lb-tint-${c}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: LUDO_FILL[c].main }} />
            <stop offset="1" style={{ stopColor: LUDO_FILL[c].dark }} />
          </linearGradient>
        </g>
      ))}
    </defs>
  );
}

/** Le plateau lui-même (dessiné une fois, sans les pions). `active` : couleurs en jeu. */
const BoardArt = memo(function BoardArt({ active }: { active: LudoColor[] }) {
  const C = CELL;
  const tint = new Map<string, LudoColor>();
  const starts = new Map<string, LudoColor>();
  for (const color of COLORS) {
    for (const [c, r] of HOME_COLUMN[color]) tint.set(`${c},${r}`, color);
    const [sc, sr] = TRACK[START_INDEX[color]] as [number, number];
    tint.set(`${sc},${sr}`, color);
    starts.set(`${sc},${sr}`, color);
  }
  const stars = new Set(SAFE_TRACK_INDEXES.filter((i) => !Object.values(START_INDEX).includes(i)).map((i) => (TRACK[i] as [number, number]).join(",")));
  const cells: [number, number][] = [];
  for (let r = 0; r < 15; r++)
    for (let c = 0; c < 15; c++) {
      const inArm = (r >= 6 && r <= 8 && (c < 6 || c > 8)) || (c >= 6 && c <= 8 && (r < 6 || r > 8));
      if (inArm) cells.push([c, r]);
    }
  const m = 7.5 * C;
  const arrows: [number, number, number][] = [
    [12, 7 * C + 12, 0],
    [7 * C + 12, 12, 90],
    [14 * C + 12, 7 * C + 12, 180],
    [7 * C + 12, 14 * C + 12, -90],
  ];
  const triangles: [LudoColor, [number, number], [number, number]][] = [
    ["red", [6, 6], [6, 9]],
    ["green", [6, 6], [9, 6]],
    ["yellow", [9, 6], [9, 9]],
    ["blue", [6, 9], [9, 9]],
  ];
  return (
    <g>
      {/* Cadre en noyer, filet de laiton et étoiles aux coins */}
      <rect x={-FRAME} y={-FRAME} width={SIZE + 2 * FRAME} height={SIZE + 2 * FRAME} rx="20" fill="url(#lb-walnut)" />
      <rect x={-FRAME} y={-FRAME} width={SIZE + 2 * FRAME} height={SIZE + 2 * FRAME} rx="20" fill="url(#lb-grain)" />
      <rect x={-13} y={-13} width={SIZE + 26} height={SIZE + 26} rx="19" fill="none" stroke="rgba(255,220,170,.25)" />
      <rect x={-6} y={-6} width={SIZE + 12} height={SIZE + 12} rx="13" fill="none" stroke="url(#lb-brass)" strokeWidth="1.6" />
      {[
        [-8, -8],
        [SIZE + 8, -8],
        [-8, SIZE + 8],
        [SIZE + 8, SIZE + 8],
      ].map(([x, y]) => (
        <polygon key={`${x},${y}`} points={starPoints(x as number, y as number, 5, 0.5)} fill="url(#lb-brassV)" />
      ))}
      <rect x="0" y="0" width={SIZE} height={SIZE} rx="6" fill="url(#lb-ivory)" />

      {/* Les quatre maisons, en zellige de leur couleur */}
      {COLORS.map((color) => {
        const [ox, oy] = BASE_ORIGIN[color];
        const x = ox * C;
        const y = oy * C;
        const W = 6 * C;
        const off = !active.includes(color);
        return (
          <g key={color} opacity={off ? 0.35 : 1}>
            <rect x={x + 2} y={y + 2} width={W - 4} height={W - 4} rx="9" fill={`url(#lb-tint-${color})`} />
            <rect x={x + 2} y={y + 2} width={W - 4} height={W - 4} rx="9" fill="url(#lb-zellige)" />
            <rect x={x + 6} y={y + 6} width={W - 12} height={W - 12} rx="6" fill="none" stroke="url(#lb-brass)" strokeWidth="1" />
            <rect x={x + C * 0.95} y={y + C * 0.95} width={4.1 * C} height={4.1 * C} rx="14" fill="url(#lb-ivory)" stroke="url(#lb-brass)" strokeWidth="1.6" filter="url(#lb-shadow)" />
            {BASE_SLOTS.map(([a, b]) => (
              <g key={`${a},${b}`}>
                <circle cx={x + a * C} cy={y + b * C} r="16" fill="rgba(0,0,0,.06)" stroke={LUDO_FILL[color].main} strokeWidth="1.5" opacity=".85" />
                <circle cx={x + a * C} cy={y + b * C} r="12.5" fill="none" stroke={LUDO_FILL[color].main} strokeWidth=".6" strokeDasharray="2 2" opacity=".7" />
              </g>
            ))}
          </g>
        );
      })}

      {/* Les cases du circuit et des couloirs */}
      {cells.map(([c, r]) => {
        const k = `${c},${r}`;
        const color = tint.get(k);
        const x = c * C;
        const y = r * C;
        return (
          <g key={k}>
            <rect x={x + 0.6} y={y + 0.6} width={C - 1.2} height={C - 1.2} rx="3" fill={color ? `url(#lb-tint-${color})` : "#f8f1e2"} stroke="rgba(138,106,51,.45)" strokeWidth=".7" />
            {color && <rect x={x + 0.6} y={y + 0.6} width={C - 1.2} height={C - 1.2} rx="3" fill="url(#lb-zellige)" />}
            {(stars.has(k) || starts.has(k)) && (
              <polygon
                points={starPoints(x + C / 2, y + C / 2, 8.5, 0.48)}
                fill={starts.has(k) ? "rgba(255,240,200,.85)" : "url(#lb-brassV)"}
                stroke="#6b4e1f"
                strokeWidth=".5"
              />
            )}
          </g>
        );
      })}

      {/* Flèches d'entrée dans les couloirs */}
      {arrows.map(([cx, cy, rot]) => (
        <g key={rot} transform={`translate(${cx},${cy}) rotate(${rot})`}>
          <path d="M-6 0 H5 M1 -4 L5 0 L1 4" fill="none" stroke="#8a6a33" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}

      {/* Le centre : quatre triangles et la rosace en laiton */}
      {triangles.map(([color, a, b]) => {
        const pts = `${a[0] * C},${a[1] * C} ${b[0] * C},${b[1] * C} ${m},${m}`;
        return (
          <g key={color}>
            <polygon points={pts} fill={`url(#lb-tint-${color})`} />
            <polygon points={pts} fill="url(#lb-zellige)" stroke="url(#lb-brass)" strokeWidth="1" />
          </g>
        );
      })}
      <circle cx={m} cy={m} r="17" fill="#2a1a10" stroke="url(#lb-brass)" strokeWidth="1.5" />
      <polygon points={starPoints(m, m, 14, 0.55)} fill="url(#lb-brassV)" stroke="#5e4219" strokeWidth=".6" />
      <circle cx={m} cy={m} r="3" fill="#2a1a10" />
    </g>
  );
});

/** Un pion : socle en laiton tourné, tête en émail de sa couleur avec une petite étoile. */
export function PawnArt({ color }: { color: LudoColor }) {
  return (
    <g filter="url(#lb-shadow)">
      <ellipse cx="0" cy="8.5" rx="9.5" ry="3.6" fill="#4a3312" />
      <ellipse cx="0" cy="7.5" rx="9.5" ry="3.4" fill="url(#lb-brass)" />
      <path d="M-8.5 7.5 C-8 2 -5 0 -3.2 -3 L3.2 -3 C5 0 8 2 8.5 7.5 Z" fill="url(#lb-brass)" />
      <path d="M-6.5 3.5 Q0 5.5 6.5 3.5" fill="none" stroke="#5e4219" strokeWidth=".6" />
      <ellipse cx="0" cy="-3.6" rx="4.6" ry="1.6" fill="var(--ludo-brass-light)" stroke="#6b4e1f" strokeWidth=".4" />
      <circle cx="0" cy="-9.5" r="6.8" fill={`url(#lb-enamel-${color})`} stroke="#5e4219" strokeWidth=".6" />
      <polygon points={starPoints(0, -9.5, 2.4, 0.5)} fill="rgba(255,240,200,.55)" />
    </g>
  );
}

export type BoardPawn = {
  /** Identifiant stable « chaise:pion ». */
  key: string;
  seat: number;
  pawn: number;
  color: LudoColor;
  step: number;
  /** Nombre de sauts déjà faits (change à chaque case pour relancer l'animation du saut). */
  hops: number;
  /** Le pion rentre à la maison (mangé) : glissement plus long. */
  returning: boolean;
  movable: boolean;
  /** Case d'arrivée si on le joue (pour montrer où il ira). */
  target: number | null;
};

type Props = {
  quarter: number;
  active: LudoColor[];
  pawns: BoardPawn[];
  onPawn?: (seat: number, pawn: number) => void;
  /** Toucher qui ne tombe sur aucun pion jouable (avec le pion le plus proche, s'il y en a un). */
  onMiss?: (near: { seat: number; pawn: number } | null) => void;
  /** Texte lu par les lecteurs d'écran pour un pion jouable. */
  pawnLabel?: (p: BoardPawn) => string;
  /** Pour la partie guidée : renvoie le plateau SVG. */
  svgRef?: React.RefObject<SVGSVGElement | null>;
  label: string;
};

/** Le plateau complet : le dessin (tourné vers toi) et les pions par-dessus, toujours debout. */
export function LudoBoard({ quarter, active, pawns, onPawn, onMiss, pawnLabel, svgRef, label }: Props) {
  const localRef = useRef<SVGSVGElement | null>(null);
  const ref = svgRef ?? localRef;

  // Position de chaque pion, en unités SVG, avec un petit décalage quand plusieurs partagent une case.
  const placed = useMemo(() => {
    const finishRank = new Map<string, number>();
    const byColor = new Map<string, number>();
    for (const p of pawns)
      if (p.step >= 56) {
        const n = byColor.get(p.color) ?? 0;
        finishRank.set(p.key, n);
        byColor.set(p.color, n + 1);
      }
    const raw = pawns.map((p) => {
      const pt = rotatePoint(pawnPoint(p.color, p.step, p.pawn, finishRank.get(p.key) ?? 0), quarter);
      return { p, pt };
    });
    const groups = new Map<string, number[]>();
    raw.forEach(({ p, pt }, i) => {
      if (p.step < 0 || p.step >= 56) return;
      const k = `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
      groups.set(k, [...(groups.get(k) ?? []), i]);
    });
    const OFFS: Point[][] = [
      [{ x: 0, y: 0 }],
      [
        { x: -0.2, y: 0.05 },
        { x: 0.2, y: -0.05 },
      ],
      [
        { x: -0.22, y: 0.12 },
        { x: 0.22, y: 0.12 },
        { x: 0, y: -0.15 },
      ],
      [
        { x: -0.22, y: 0.18 },
        { x: 0.22, y: 0.18 },
        { x: -0.22, y: -0.16 },
        { x: 0.22, y: -0.16 },
      ],
    ];
    const out = raw.map(({ p, pt }) => ({ p, x: pt.x * CELL, y: pt.y * CELL, scale: p.step >= 56 ? 0.62 : 1 }));
    for (const idx of groups.values()) {
      if (idx.length < 2) continue;
      const offs = OFFS[Math.min(idx.length, 4) - 1] as Point[];
      idx.forEach((i, n) => {
        const o = offs[n % offs.length] as Point;
        const item = out[i]!;
        item.x += o.x * CELL;
        item.y += o.y * CELL;
        item.scale = 0.78;
      });
    }
    // Les pions du bas passent devant ceux du haut.
    return out.sort((a, b) => a.y - b.y);
  }, [pawns, quarter]);

  const targets = useMemo(
    () =>
      pawns
        .filter((p) => p.movable && p.target !== null)
        .map((p) => {
          const pt = rotatePoint(pawnPoint(p.color, p.target as number, p.pawn), quarter);
          return { key: p.key, color: p.color, x: pt.x * CELL, y: pt.y * CELL };
        }),
    [pawns, quarter],
  );

  /** Toucher le plateau : on prend le pion jouable le plus proche (zone tactile large). */
  function onPointerUp(e: PointerEvent<SVGSVGElement>) {
    if (!onPawn && !onMiss) return;
    const svg = ref.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    let best: { seat: number; pawn: number; d: number } | null = null;
    for (const { p, x, y } of placed) {
      if (!p.movable) continue;
      const d = Math.hypot(pt.x - x, pt.y - (y - 4));
      if (d < CELL * 1.6 && (!best || d < best.d)) best = { seat: p.seat, pawn: p.pawn, d };
    }
    // On peut aussi toucher la case d'arrivée.
    for (const t of targets) {
      const d = Math.hypot(pt.x - t.x, pt.y - t.y);
      const p = pawns.find((x) => x.key === t.key);
      if (p && d < CELL * 0.9 && (!best || d < best.d)) best = { seat: p.seat, pawn: p.pawn, d };
    }
    if (best) {
      onPawn?.(best.seat, best.pawn);
      return;
    }
    let near: { seat: number; pawn: number; d: number } | null = null;
    for (const { p, x, y } of placed) {
      const d = Math.hypot(pt.x - x, pt.y - (y - 4));
      if (d < CELL && (!near || d < near.d)) near = { seat: p.seat, pawn: p.pawn, d };
    }
    onMiss?.(near ? { seat: near.seat, pawn: near.pawn } : null);
  }

  return (
    <svg
      ref={ref}
      viewBox={`${-FRAME} ${-FRAME} ${SIZE + 2 * FRAME} ${SIZE + 2 * FRAME}`}
      className="ludo-motion block size-full touch-manipulation select-none"
      style={{ filter: "drop-shadow(0 16px 22px rgb(0 0 0 / 0.65))" }}
      onPointerUp={onPointerUp}
      role="group"
      aria-label={label}
    >
      <Defs />
      <g transform={`rotate(${quarter * 90} ${SIZE / 2} ${SIZE / 2})`}>
        <BoardArt active={active} />
      </g>

      {/* Où ira chaque pion jouable */}
      {targets.map((t) => (
        <circle
          key={`t-${t.key}`}
          cx={t.x}
          cy={t.y}
          r="8.5"
          fill="rgba(255,255,255,.35)"
          stroke={LUDO_FILL[t.color].main}
          strokeWidth="1.6"
          strokeDasharray="3 2.4"
          className="animate-glow"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      ))}

      {placed.map(({ p, x, y, scale }) => (
        <g
          key={p.key}
          style={{
            transform: `translate(${x}px, ${y - 3}px)`,
            transition: `transform ${p.returning ? "450ms cubic-bezier(.3,.7,.2,1)" : "var(--ludo-hop-ms) ease-out"}`,
          }}
          role={p.movable ? "button" : undefined}
          tabIndex={p.movable ? 0 : undefined}
          aria-label={p.movable && pawnLabel ? pawnLabel(p) : undefined}
          onKeyDown={(e) => {
            if (p.movable && onPawn && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onPawn(p.seat, p.pawn);
            }
          }}
        >
          {p.movable && (
            <ellipse cx="0" cy="8" rx="13" ry="5.5" fill="none" stroke="var(--ludo-brass-light)" strokeWidth="2.2" className="animate-glow" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
          )}
          <g style={{ transform: `scale(${scale})`, transition: "transform 200ms ease-out" }}>
            <g key={p.hops} className={p.hops ? "animate-hop" : undefined}>
              <PawnArt color={p.color} />
            </g>
          </g>
        </g>
      ))}
    </svg>
  );
}
