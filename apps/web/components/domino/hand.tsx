"use client";

import { type TileId, parseTile } from "@icosium/shared";
import { useLayoutEffect, useRef, useState } from "react";
import { DominoTile } from "./tile";

type Props = {
  tiles: TileId[];
  playable: Set<TileId>;
  selected: TileId | null;
  myTurn: boolean;
  pending: boolean;
  onTap: (tile: TileId) => void;
  /** Paysage : une rangée plus basse pour laisser la place à la table. */
  compact?: boolean;
};

/** Ma main, en bas de l'écran. Les dominos jouables sont légèrement surélevés. */
export function DominoHand({ tiles, playable, selected, myTurn, pending, onTap, compact = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Rangés par valeur, pour s'y retrouver d'un coup d'œil.
  const sorted = [...tiles].sort((x, y) => {
    const [a1, b1] = parseTile(x);
    const [a2, b2] = parseTile(y);
    return a1 - a2 || b1 - b2;
  });
  const size = Math.max(compact ? 24 : 26, Math.min(compact ? 34 : 44, Math.floor((width - 8) / Math.max(sorted.length, 7)) - 6));
  const overlap = sorted.length * (size + 6) > width;

  return (
    <div ref={ref} dir="ltr" className={`flex w-full items-end justify-center pb-1 ${compact ? "min-h-[4.6rem]" : "min-h-[7.5rem]"}`}>
      {sorted.map((tile, i) => {
        const [a, b] = parseTile(tile);
        const canPlay = myTurn && playable.has(tile);
        const isSelected = selected === tile;
        const lift = isSelected ? (compact ? "-translate-y-2.5" : "-translate-y-4") : canPlay ? (compact ? "-translate-y-1" : "-translate-y-2") : "translate-y-0";
        return (
          <button
            key={tile}
            type="button"
            disabled={pending}
            onClick={() => onTap(tile)}
            aria-pressed={isSelected}
            data-playable={canPlay ? "true" : undefined}
            aria-label={`${a}-${b}`}
            style={{ marginInlineStart: overlap && i > 0 ? -Math.round(size * 0.25) : 3 }}
            className={`relative rounded-[10px] transition-[transform,opacity,filter] duration-200 ease-icos ${lift} ${
              myTurn && !canPlay ? "opacity-55 saturate-50" : ""
            } ${canPlay ? "drop-shadow-[0_6px_6px_rgba(47,158,120,0.45)]" : "drop-shadow-[0_3px_3px_rgba(40,20,5,0.35)]"}`}
          >
            <DominoTile a={a} b={b} size={size} />
            {isSelected && <span className="pointer-events-none absolute inset-0 rounded-[10px] ring-3 ring-mint" />}
          </button>
        );
      })}
    </div>
  );
}
