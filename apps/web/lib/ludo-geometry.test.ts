import { SAFE_TRACK_INDEXES, START_INDEX } from "@icosium/shared";
import { describe, expect, it } from "vitest";
import { GRID, HOME_COLUMN, TRACK, pawnPoint, quarterFor, rotatePoint, screenCorner } from "./ludo-geometry";

describe("plateau de Ludo", () => {
  it("a 52 cases de circuit, toutes différentes, chacune voisine de la suivante", () => {
    expect(TRACK).toHaveLength(52);
    expect(new Set(TRACK.map((c) => c.join(","))).size).toBe(52);
    TRACK.forEach(([c, r], i) => {
      const [nc, nr] = TRACK[(i + 1) % 52] as [number, number];
      // Une case de distance (ou un coin en diagonale, à l'entrée des bras).
      expect(Math.max(Math.abs(nc - c), Math.abs(nr - r))).toBe(1);
    });
  });

  it("met les départs et les étoiles là où la maquette les dessine", () => {
    expect(TRACK[START_INDEX.red]).toEqual([1, 6]);
    expect(TRACK[START_INDEX.green]).toEqual([8, 1]);
    expect(TRACK[START_INDEX.yellow]).toEqual([13, 8]);
    expect(TRACK[START_INDEX.blue]).toEqual([6, 13]);
    const stars = SAFE_TRACK_INDEXES.filter((i) => !Object.values(START_INDEX).includes(i)).map((i) => TRACK[i]);
    expect(stars).toEqual([[6, 2], [12, 6], [8, 12], [2, 8]]);
  });

  it("fait entrer chaque couleur dans son couloir juste après sa dernière case", () => {
    for (const color of ["red", "green", "yellow", "blue"] as const) {
      const last = pawnPoint(color, 50, 0);
      const first = pawnPoint(color, 51, 0);
      expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeCloseTo(1);
      expect(HOME_COLUMN[color]).toHaveLength(5);
    }
  });

  it("tourne le plateau pour que ta couleur soit toujours en bas à gauche", () => {
    for (const color of ["red", "green", "yellow", "blue"] as const) expect(screenCorner(color, quarterFor(color))).toBe(3);
    expect(rotatePoint({ x: 0, y: 0 }, 1)).toEqual({ x: GRID, y: 0 });
    expect(rotatePoint({ x: 3, y: 4 }, 4)).toEqual({ x: 3, y: 4 });
  });
});
