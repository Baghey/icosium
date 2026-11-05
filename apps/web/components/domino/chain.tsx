"use client";

import type { End, PlacedTile } from "@icosium/shared";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DominoTile } from "./tile";

type Item =
  | { kind: "tile"; key: string; placed: PlacedTile; double: boolean }
  | { kind: "slot"; key: string; end: End };

type Props = {
  chain: PlacedTile[];
  /** Bouts où le domino choisi peut aller ; on y dessine un emplacement à toucher. */
  targets: End[];
  onPick: (end: End) => void;
  pickLabel: string;
  /** Domino qui vient d'être posé (animé). */
  freshTile: string | null;
};

const GAP = 3;

/**
 * La chaîne au centre de la table. Quand elle devient trop longue, elle se replie en serpent :
 * une ligne de gauche à droite, la suivante de droite à gauche, comme sur une vraie table.
 */
export function DominoChain({ chain, targets, onPick, pickLabel, freshTile }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Taille d'un domino : plus petite quand la chaîne s'allonge, pour que tout reste visible.
  const unit = useMemo(() => {
    const n = chain.length;
    const base = n <= 8 ? Math.min(36, Math.floor(width / 10)) : Math.min(30, Math.floor(width / 13));
    return n > 20 ? Math.max(16, base - 6) : n > 12 ? Math.max(18, base - 3) : base;
  }, [width, chain.length]);

  const items: Item[] = useMemo(() => {
    const list: Item[] = chain.map((p, i) => ({ kind: "tile", key: `${p.tile}-${i}`, placed: p, double: p.left === p.right }));
    if (targets.includes("left") && chain.length > 0) list.unshift({ kind: "slot", key: "slot-left", end: "left" });
    if (targets.includes("right")) list.push({ kind: "slot", key: "slot-right", end: "right" });
    return list;
  }, [chain, targets]);

  const rows = useMemo(() => {
    const out: Item[][] = [];
    let row: Item[] = [];
    let x = 0;
    for (const item of items) {
      const w = (item.kind === "tile" && item.double ? unit : unit * 2) + GAP;
      if (row.length > 0 && x + w > width) {
        out.push(row);
        row = [];
        x = 0;
      }
      row.push(item);
      x += w;
    }
    if (row.length) out.push(row);
    return out;
  }, [items, unit, width]);

  return (
    <div ref={boxRef} dir="ltr" className="flex w-full flex-col items-center justify-center gap-[3px]">
      {rows.map((row, r) => {
        const reversed = r % 2 === 1;
        return (
          <div key={r} className={`flex items-center justify-center gap-[3px] ${reversed ? "flex-row-reverse" : "flex-row"}`}>
            {row.map((item) =>
              item.kind === "slot" ? (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onPick(item.end)}
                  aria-label={`${pickLabel} (${item.end === "left" ? "←" : "→"})`}
                  style={{ width: unit * 2, height: unit }}
                  className="animate-slot rounded-[6px] border-2 border-dashed border-white/90 bg-mint/50 shadow-[0_0_12px_rgba(92,201,162,0.6)]"
                />
              ) : (
                <PlacedDomino key={item.key} item={item} unit={unit} reversed={reversed} fresh={freshTile === item.placed.tile} />
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlacedDomino({
  item,
  unit,
  reversed,
  fresh,
}: {
  item: Extract<Item, { kind: "tile" }>;
  unit: number;
  reversed: boolean;
  fresh: boolean;
}) {
  const [animate, setAnimate] = useState(fresh);
  useEffect(() => {
    if (!fresh) return;
    setAnimate(true);
    const t = window.setTimeout(() => setAnimate(false), 400);
    return () => window.clearTimeout(t);
  }, [fresh]);
  const { left, right } = item.placed;
  // Dans une ligne qui va de droite à gauche, le domino est retourné.
  const a = reversed ? right : left;
  const b = reversed ? left : right;
  return (
    <div className={`drop-shadow-[0_2px_1.5px_rgba(40,20,5,0.45)] ${animate ? "animate-place" : ""}`}>
      {item.double ? (
        <DominoTile a={a} b={b} orientation="vertical" size={unit} />
      ) : (
        <DominoTile a={a} b={b} orientation="horizontal" size={unit} />
      )}
    </div>
  );
}
