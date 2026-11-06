/**
 * Géométrie du plateau de Ludo : une grille de 15 × 15 cases. Les coordonnées sont en cases
 * (colonne, rangée), le centre d'une case étant à +0,5. Le plateau « de référence » a le rouge en
 * haut à gauche ; à l'écran, on le tourne pour que ta couleur soit toujours en bas à gauche.
 */
import { BASE_STEP, FINISH_STEP, LAST_TRACK_STEP, type LudoColor, START_INDEX, TRACK_LENGTH } from "@icosium/shared";

export const GRID = 15;
export type Point = { x: number; y: number };

/** Les 52 cases du circuit, dans l'ordre, à partir de la case de départ du rouge. [colonne, rangée] */
export const TRACK: readonly [number, number][] = (() => {
  const out: [number, number][] = [];
  const add = (c: number, r: number) => out.push([c, r]);
  for (let c = 1; c <= 5; c++) add(c, 6); // 0-4 : départ rouge, vers la droite
  for (let r = 5; r >= 0; r--) add(6, r); // 5-10 : on monte
  add(7, 0); // 11
  for (let r = 0; r <= 5; r++) add(8, r); // 12-17 : départ vert en 13
  for (let c = 9; c <= 14; c++) add(c, 6); // 18-23
  add(14, 7); // 24
  for (let c = 14; c >= 9; c--) add(c, 8); // 25-30 : départ jaune en 26
  for (let r = 9; r <= 14; r++) add(8, r); // 31-36
  add(7, 14); // 37
  for (let r = 14; r >= 9; r--) add(6, r); // 38-43 : départ bleu en 39
  for (let c = 5; c >= 0; c--) add(c, 8); // 44-49
  add(0, 7); // 50
  add(0, 6); // 51
  return out;
})();

/** Le couloir de chaque couleur (5 cases, de l'entrée vers le centre). */
export const HOME_COLUMN: Record<LudoColor, readonly [number, number][]> = {
  red: [1, 2, 3, 4, 5].map((c) => [c, 7] as [number, number]),
  green: [1, 2, 3, 4, 5].map((r) => [7, r] as [number, number]),
  yellow: [13, 12, 11, 10, 9].map((c) => [c, 7] as [number, number]),
  blue: [13, 12, 11, 10, 9].map((r) => [7, r] as [number, number]),
};

/** Coin de la maison de chaque couleur (sur le plateau de référence). */
export const BASE_ORIGIN: Record<LudoColor, [number, number]> = { red: [0, 0], green: [9, 0], yellow: [9, 9], blue: [0, 9] };
/** Les 4 places de la maison, en cases depuis son coin. */
export const BASE_SLOTS: readonly [number, number][] = [
  [1.95, 1.95],
  [4.05, 1.95],
  [1.95, 4.05],
  [4.05, 4.05],
];
/** Coin du plateau de chaque couleur : 0 haut-gauche, 1 haut-droite, 2 bas-droite, 3 bas-gauche. */
export const CORNER: Record<LudoColor, number> = { red: 0, green: 1, yellow: 2, blue: 3 };

/** Où se posent les pions arrivés : dans le triangle de leur couleur, au centre. */
const FINISH_SPOTS: Record<LudoColor, Point[]> = {
  red: [
    { x: 6.55, y: 7.1 },
    { x: 6.55, y: 7.9 },
    { x: 6.95, y: 7.5 },
    { x: 6.25, y: 7.5 },
  ],
  green: [
    { x: 7.1, y: 6.55 },
    { x: 7.9, y: 6.55 },
    { x: 7.5, y: 6.95 },
    { x: 7.5, y: 6.25 },
  ],
  yellow: [
    { x: 8.45, y: 7.1 },
    { x: 8.45, y: 7.9 },
    { x: 8.05, y: 7.5 },
    { x: 8.75, y: 7.5 },
  ],
  blue: [
    { x: 7.1, y: 8.45 },
    { x: 7.9, y: 8.45 },
    { x: 7.5, y: 8.05 },
    { x: 7.5, y: 8.75 },
  ],
};

const center = ([c, r]: readonly [number, number]): Point => ({ x: c + 0.5, y: r + 0.5 });

/** Point (centre, en cases, plateau de référence) d'un pion. `finishSlot` : rang parmi les pions arrivés. */
export function pawnPoint(color: LudoColor, step: number, pawn: number, finishSlot = 0): Point {
  if (step === BASE_STEP) {
    const [ox, oy] = BASE_ORIGIN[color];
    const [sx, sy] = BASE_SLOTS[pawn] as [number, number];
    return { x: ox + sx, y: oy + sy };
  }
  if (step >= FINISH_STEP) return FINISH_SPOTS[color][finishSlot % 4] as Point;
  if (step > LAST_TRACK_STEP) return center(HOME_COLUMN[color][step - LAST_TRACK_STEP - 1] as [number, number]);
  return center(TRACK[(START_INDEX[color] + step) % TRACK_LENGTH] as [number, number]);
}

/** Tourne un point d'un quart de tour (sens des aiguilles d'une montre) `quarter` fois. */
export function rotatePoint(p: Point, quarter: number): Point {
  let { x, y } = p;
  for (let i = 0; i < ((quarter % 4) + 4) % 4; i++) [x, y] = [GRID - y, x];
  return { x, y };
}

/** Combien de quarts de tour pour que `color` soit en bas à gauche. */
export function quarterFor(color: LudoColor): number {
  return (3 - CORNER[color] + 4) % 4;
}

/** Coin de l'écran (0 haut-gauche … 3 bas-gauche) où se trouve `color` une fois le plateau tourné. */
export function screenCorner(color: LudoColor, quarter: number): number {
  return (CORNER[color] + quarter) % 4;
}

/** Cases sur lesquelles passe un pion de `from` à `to` (pour le faire sauter case par case). */
export function hopSteps(from: number, to: number): number[] {
  if (from === BASE_STEP) return [0];
  const out: number[] = [];
  for (let s = from + 1; s <= to; s++) out.push(s);
  return out;
}
