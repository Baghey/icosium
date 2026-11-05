/** Un domino s'écrit "a-b" avec a ≤ b, par exemple "2-6" ou "6-6". */
export type TileId = `${number}-${number}`;

export const MAX_PIP = 6;

export function tileId(a: number, b: number): TileId {
  return a <= b ? `${a}-${b}` : `${b}-${a}`;
}

export function parseTile(id: TileId): [number, number] {
  const [a, b] = id.split("-").map(Number) as [number, number];
  return [a, b];
}

/** Valeur d'un domino = somme de ses deux côtés (le 4-6 vaut 10). */
export function tileValue(id: TileId): number {
  const [a, b] = parseTile(id);
  return a + b;
}

export function isDouble(id: TileId): boolean {
  const [a, b] = parseTile(id);
  return a === b;
}

export function isValidTileId(value: unknown): value is TileId {
  if (typeof value !== "string" || !/^\d-\d$/.test(value)) return false;
  const [a, b] = value.split("-").map(Number) as [number, number];
  return a <= b && b <= MAX_PIP;
}

/** Les 28 dominos, de 0-0 à 6-6. */
export function fullSet(): TileId[] {
  const set: TileId[] = [];
  for (let a = 0; a <= MAX_PIP; a++) for (let b = a; b <= MAX_PIP; b++) set.push(tileId(a, b));
  return set;
}

export function handValue(hand: readonly TileId[]): number {
  return hand.reduce((sum, t) => sum + tileValue(t), 0);
}

/** Générateur aléatoire : renvoie un nombre dans [0, 1). Injecté pour pouvoir tester. */
export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** Générateur déterministe (pour les tests). */
export function seededRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
