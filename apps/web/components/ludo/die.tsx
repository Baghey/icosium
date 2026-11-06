"use client";

import { useEffect, useId, useState } from "react";

const PIPS: Record<number, [number, number][]> = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [3, 1], [1, 3], [3, 3]],
  5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]],
  6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]],
};

/** Une face de dé : ivoire, liseré de laiton, points en laiton creusés. `value` null : face vide. */
export function DieFace({ value, size = 36, dim = false }: { value: number | null; size?: number; dim?: boolean }) {
  const id = useId().replace(/:/g, "");
  const s = 36;
  const u = (s - 4) / 4;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${s} ${s}`} aria-hidden="true" style={{ opacity: dim ? 0.55 : 1 }}>
      <defs>
        <radialGradient id={`iv${id}`} cx=".38" cy=".32" r=".85">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#d8c49e" />
        </radialGradient>
        <radialGradient id={`pp${id}`} cx=".35" cy=".3">
          <stop offset="0" style={{ stopColor: "var(--ludo-brass-light)" }} />
          <stop offset="1" stopColor="#7a5a24" />
        </radialGradient>
      </defs>
      <rect x="2" y="3" width={s - 4} height={s - 4} rx={s * 0.22} fill="#9c8457" />
      <rect x="2" y="1" width={s - 4} height={s - 4} rx={s * 0.22} fill={`url(#iv${id})`} stroke="var(--ludo-brass)" strokeWidth="1" />
      {(value ? PIPS[value] ?? [] : []).map(([a, b]) => (
        <circle key={`${a},${b}`} cx={2 + a * u} cy={1 + b * u} r={s * 0.085} fill={`url(#pp${id})`} stroke="var(--ludo-brass-dark)" strokeWidth=".5" />
      ))}
    </svg>
  );
}

/**
 * Le dé qui roule : pendant un peu plus d'une demi-seconde il tourne en montrant des faces au
 * hasard, puis se pose sur le vrai chiffre (tiré par le serveur). Sans animation si l'appareil
 * demande moins de mouvement.
 */
export function RollingDie({ value, rollKey, size = 36, dim = false }: { value: number | null; rollKey: number; size?: number; dim?: boolean }) {
  const [shown, setShown] = useState(value);
  const [rolling, setRolling] = useState(false);
  useEffect(() => {
    if (!rollKey) {
      setShown(value);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }
    setRolling(true);
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setShown(1 + Math.floor(Math.random() * 6));
      if (n >= 7) {
        window.clearInterval(id);
        setShown(value);
        setRolling(false);
      }
    }, 75);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey]);
  useEffect(() => {
    if (!rolling) setShown(value);
  }, [value, rolling]);
  return (
    <span key={rollKey} className={`ludo-motion inline-block ${rollKey ? "animate-dice" : ""}`}>
      <DieFace value={shown} size={size} dim={dim} />
    </span>
  );
}
