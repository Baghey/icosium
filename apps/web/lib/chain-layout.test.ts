import { describe, expect, it } from "vitest";
import { type PlacedTile, fullSet, parseTile, seededRng } from "@icosium/shared";
import { CHAIN_HALF_D, CHAIN_HALF_W, extent, layoutChain } from "./chain-layout";

const p = (l: number, r: number): PlacedTile => ({ tile: `${Math.min(l, r)}-${Math.max(l, r)}` as PlacedTile["tile"], left: l, right: r, seat: 0 });

type Tiles = ReturnType<typeof layoutChain>["tiles"];

/** Deux pierres qui se chevauchent (boîtes 1 × 2 tournées par quarts de tour), ou null. */
function overlaps(tiles: Tiles) {
  const box = (t: Tiles[number]) => {
    const { hx, hz } = extent(t);
    return { x0: t.x - hx, x1: t.x + hx, z0: t.z - hz, z1: t.z + hz };
  };
  for (let i = 0; i < tiles.length; i++)
    for (let j = i + 1; j < tiles.length; j++) {
      const a = box(tiles[i]!);
      const b = box(tiles[j]!);
      if (a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01 && a.z0 < b.z1 - 0.01 && b.z0 < a.z1 - 0.01) return [tiles[i]!.tile, tiles[j]!.tile];
    }
  return null;
}

/** Une partie au hasard : on pose des pierres jouables, à un bout au hasard, jusqu'à 28. */
function randomChain(seed: number, oneArm = false): { chain: PlacedTile[]; starts: number[] } {
  const rng = seededRng(seed);
  const pool = fullSet();
  const take = (i: number) => pool.splice(i, 1)[0]!;
  const [a0, b0] = parseTile(take(Math.floor(rng() * pool.length)));
  const chain: PlacedTile[] = [p(a0, b0)];
  const starts = [0];
  let start = 0;
  for (;;) {
    const left = chain[0]!.left;
    const right = chain[chain.length - 1]!.right;
    const moves: { i: number; end: "left" | "right" }[] = [];
    pool.forEach((t, i) => {
      const [a, b] = parseTile(t);
      if (a === left || b === left) moves.push({ i, end: "left" });
      if (a === right || b === right) moves.push({ i, end: "right" });
    });
    const usable = oneArm && moves.some((x) => x.end === "right") ? moves.filter((x) => x.end === "right") : moves;
    if (usable.length === 0) break;
    const m = usable[Math.floor(rng() * usable.length)]!;
    const [a, b] = parseTile(take(m.i));
    if (m.end === "left") {
      chain.unshift(p(a === left ? b : a, left));
      start += 1;
    } else chain.push(p(right, a === right ? b : a));
    starts.push(start);
  }
  return { chain, starts };
}

describe("la chaîne sur la table", () => {
  it("le premier domino posé reste au centre même quand on joue à gauche", () => {
    const { tiles } = layoutChain([p(1, 6), p(6, 6), p(6, 3)], 1, CHAIN_HALF_W);
    expect(tiles.find((t) => t.tile === "6-6")).toMatchObject({ x: 0, z: 0, double: true });
  });
  it("à chaque bout, la valeur qui touche est du côté du centre", () => {
    const { tiles } = layoutChain([p(2, 4), p(4, 5), p(5, 1)], 1, CHAIN_HALF_W);
    expect(tiles.find((t) => t.tile === "2-4")!.a).toBe(4);
    expect(tiles.find((t) => t.tile === "1-5")!.a).toBe(5);
  });
  it("une rangée complète tient 6 pierres, coin compris", () => {
    // Bras droit seul, sans double : on compte les pierres de la 2e rangée et son coin.
    const chain: PlacedTile[] = [];
    let v = 0;
    for (let i = 0; i < 16; i++) {
      const n = (v + 1 + (i % 3)) % 7;
      chain.push(p(v, n));
      v = n;
    }
    const { tiles } = layoutChain(chain, 0, CHAIN_HALF_W);
    const rowZ = tiles.filter((t) => t.z > 1 && extent(t).hx === 1)[0]!.z;
    const row = tiles.filter((t) => t.z >= rowZ - 0.01 && t.z <= rowZ + 0.55);
    expect(row.length).toBeGreaterThanOrEqual(6);
  });

  it("500 parties au hasard : jamais de chevauchement, rien hors du feutre, une pierre posée ne bouge plus", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const { chain, starts } = randomChain(seed);
      let previous = new Map<string, { x: number; z: number; rot: number }>();
      // Les états successifs de la partie : la chaîne grandit d'une pierre à gauche ou à droite.
      const order: PlacedTile[][] = [];
      let lo = starts[starts.length - 1]!; // place du premier domino posé dans la chaîne finale
      let hi = lo;
      order.push(chain.slice(lo, hi + 1));
      for (let k = 1; k < starts.length; k++) {
        if (starts[k]! > starts[k - 1]!) lo -= 1;
        else hi += 1;
        order.push(chain.slice(lo, hi + 1));
      }
      order.forEach((partial, k) => {
        const { tiles, bounds } = layoutChain(partial, starts[k]!, CHAIN_HALF_W);
        expect(overlaps(tiles), `partie ${seed}, ${partial.length} pierres`).toBeNull();
        expect(bounds.minX).toBeGreaterThanOrEqual(-CHAIN_HALF_W - 0.01);
        expect(bounds.maxX).toBeLessThanOrEqual(CHAIN_HALF_W + 0.01);
        expect(bounds.minZ, `partie ${seed}`).toBeGreaterThanOrEqual(-CHAIN_HALF_D);
        expect(bounds.maxZ, `partie ${seed}`).toBeLessThanOrEqual(CHAIN_HALF_D);
        for (const t of tiles) {
          const before = previous.get(t.tile);
          if (before) expect({ x: t.x, z: t.z, rot: t.rot }).toEqual(before);
        }
        previous = new Map(tiles.map((t) => [t.tile, { x: t.x, z: t.z, rot: t.rot }]));
      });
    }
  });
  it("même si tout le monde joue du même côté, la chaîne reste sur le feutre", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { chain, starts } = randomChain(seed, true);
      const { tiles, bounds } = layoutChain(chain, starts[starts.length - 1]!, CHAIN_HALF_W);
      expect(overlaps(tiles), `partie ${seed}`).toBeNull();
      expect(Math.max(-bounds.minZ, bounds.maxZ), `partie ${seed} (${chain.length} pierres)`).toBeLessThanOrEqual(CHAIN_HALF_D);
    }
  });
  it("un double ne fait jamais le coin : il est toujours en travers de sa rangée", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { chain, starts } = randomChain(seed);
      const { tiles } = layoutChain(chain, starts[starts.length - 1]!, CHAIN_HALF_W);
      for (const t of tiles.filter((x) => x.double && x.index !== starts[starts.length - 1])) {
        // En travers d'une rangée horizontale = posé le long de z.
        const neighbours = tiles.filter((o) => Math.abs(o.index - t.index) === 1);
        const inRow = neighbours.every((o) => Math.abs(o.z - t.z) < 0.01);
        if (inRow) expect(extent(t).hz).toBe(1);
      }
    }
  });
});
