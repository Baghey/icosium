import { describe, expect, it } from "vitest";
import type { PlacedTile } from "@icosium/shared";
import { layoutChain } from "./chain-layout";

const p = (l: number, r: number): PlacedTile => ({ tile: `${Math.min(l, r)}-${Math.max(l, r)}` as PlacedTile["tile"], left: l, right: r, seat: 0 });

/** Deux dominos ne se chevauchent jamais (boîtes 1 × 2 tournées par quarts de tour). */
function overlaps(tiles: ReturnType<typeof layoutChain>["tiles"]) {
  const box = (t: (typeof tiles)[number]) => {
    const horiz = Math.abs(Math.cos(t.rot)) > 0.5;
    const hw = horiz ? 1 : 0.5;
    const hd = horiz ? 0.5 : 1;
    return { x0: t.x - hw, x1: t.x + hw, z0: t.z - hd, z1: t.z + hd };
  };
  for (let i = 0; i < tiles.length; i++)
    for (let j = i + 1; j < tiles.length; j++) {
      const a = box(tiles[i]!);
      const b = box(tiles[j]!);
      if (a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01 && a.z0 < b.z1 - 0.01 && b.z0 < a.z1 - 0.01) return [tiles[i]!.tile, tiles[j]!.tile];
    }
  return null;
}

describe("la chaîne sur la table", () => {
  it("le premier domino posé reste au centre même quand on joue à gauche", () => {
    const { tiles } = layoutChain([p(1, 6), p(6, 6), p(6, 3)], 1, 5);
    expect(tiles.find((t) => t.tile === "6-6")).toMatchObject({ x: 0, z: 0, double: true });
  });
  it("une longue chaîne tourne au bord, sans couper ni chevaucher", () => {
    const chain: PlacedTile[] = [];
    let v = 0;
    for (let i = 0; i < 14; i++) {
      const n = (v + 1 + (i % 5)) % 7;
      chain.push(p(v, n === v ? (n + 1) % 7 : n));
      v = chain[chain.length - 1]!.right;
    }
    const { tiles, slots } = layoutChain(chain, 0, 5);
    expect(tiles).toHaveLength(14);
    expect(overlaps(tiles)).toBeNull();
    expect(Math.max(...tiles.map((t) => Math.abs(t.x) + (Math.abs(Math.cos(t.rot)) > 0.5 ? 1 : 0.5)))).toBeLessThanOrEqual(6.2);
    expect(tiles.some((t) => t.z > 0.9)).toBe(true); // elle a tourné vers le joueur
    expect(slots.right).toBeDefined();
  });
  it("à chaque bout, la valeur qui touche est du côté du centre", () => {
    const { tiles } = layoutChain([p(2, 4), p(4, 5), p(5, 1)], 1, 5);
    const leftArm = tiles.find((t) => t.tile === "2-4")!;
    expect(leftArm.a).toBe(4); // côté centre
    const rightArm = tiles.find((t) => t.tile === "1-5")!;
    expect(rightArm.a).toBe(5);
  });
});
