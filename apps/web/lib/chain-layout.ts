import type { End, PlacedTile } from "@icosium/shared";

/**
 * Place la chaîne de dominos sur la table, comme sur une vraie table : elle part du premier
 * domino posé, au centre, et chaque bout avance tout droit puis tourne avant le bord, sans jamais
 * se couper. Le bras droit descend vers le joueur, le bras gauche monte : la chaîne forme un S.
 *
 * Règles (voir /mnt/project-files/recherche/references-domino.md) :
 * - une pierre posée ne bouge plus : sa place ne dépend que des pierres posées avant elle ;
 * - on tourne quand la pierre suivante ET la place d'un double et d'un coin ne tiennent plus ;
 * - un double ne fait jamais le coin : il se pose en travers dans la rangée ;
 * - les rangées sont assez espacées pour que deux doubles en travers ne se touchent pas.
 *
 * Unités : un domino fait 1 de large et 2 de long. x vers la droite, z vers le joueur.
 */
export type Placement = {
  tile: string;
  x: number;
  z: number;
  /** Angle autour de l'axe vertical (0 = domino couché le long de x). */
  rot: number;
  /** Valeur de la moitié côté -x local, puis côté +x local. */
  a: number;
  b: number;
  double: boolean;
  index: number;
};

export type Slot = { end: End; x: number; z: number; rot: number };

/** Boîte qui entoure toutes les pierres (pour que la caméra cadre toute la chaîne). */
export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

export type ChainLayout = { tiles: Placement[]; slots: Record<End, Slot>; bounds: Bounds };

/** Le feutre de la table 3D, en unités de la scène (une largeur de domino = 1). */
export const FELT_W = 11;
export const FELT_D = 15;
/** La chaîne est dessinée un peu plus petite que les pierres de la main, pour tenir 7 à 8 pierres par rangée. */
export const CHAIN_SCALE = 0.72;
/**
 * Sur téléphone, la table est plus longue que large : la chaîne est tournée d'un quart de tour pour
 * que ses rangées courent dans la longueur du feutre. Ici, « x » (le sens des rangées) suit donc la
 * profondeur de la table, et « z » (l'empilement des rangées) sa largeur.
 * Zone où la chaîne a le droit d'aller, en unités de la chaîne (marge avant le rebord).
 */
export const CHAIN_HALF_W = (FELT_D / 2 - 0.35) / CHAIN_SCALE;
export const CHAIN_HALF_D = (FELT_W / 2 - 0.15) / CHAIN_SCALE;

type Vec = { x: number; z: number };
export const GAP = 0.06;
/** Place gardée au bout d'une rangée : un double en travers puis un coin. */
const RESERVE = 2 * (1 + GAP);
const angleOf = (d: Vec) => Math.atan2(-d.z, d.x);

/** Le bras droit tourne vers le joueur, le bras gauche vers le haut. */
function turn(d: Vec, arm: End, rowsTurned: number): Vec {
  // En revenant d'un tour vertical, une rangée sur deux repart en sens inverse.
  const reversed = ((rowsTurned + 1) / 2) % 2 === 1;
  if (d.z !== 0) return { x: reversed ? (arm === "right" ? -1 : 1) : arm === "right" ? 1 : -1, z: 0 };
  return { x: 0, z: arm === "right" ? 1 : -1 };
}

type Cursor = { p: Vec; d: Vec; turns: number; arm: End };

function place(c: Cursor, double: boolean, halfW: number): { center: Vec; rot: number } {
  const vertical = c.d.z !== 0;
  // Un double tient toujours (la réserve est là pour lui) ; une pierre simple doit laisser la réserve.
  const tooFar = !vertical && !double && Math.abs(c.p.x + c.d.x * (2 + GAP)) + RESERVE > halfW;
  if (vertical || tooFar) {
    // La pierre qui tourne se pose en long dans la nouvelle direction, collée à la précédente.
    const nd = turn(c.d, c.arm, c.turns);
    const center = { x: c.p.x + c.d.x * (0.5 + GAP) + nd.x * 0.5, z: c.p.z + c.d.z * (0.5 + GAP) + nd.z * 0.5 };
    // Deux rangées sont à 2,12 l'une de l'autre : deux doubles en travers (2 de long) ne se touchent pas.
    c.p = { x: c.p.x + c.d.x * (0.5 + GAP) + nd.x * (1.5 + GAP), z: c.p.z + c.d.z * (0.5 + GAP) + nd.z * (1.5 + GAP) };
    c.d = nd;
    c.turns += 1;
    return { center, rot: angleOf(nd) };
  }
  const len = double ? 1 : 2;
  const center = { x: c.p.x + c.d.x * (len / 2 + GAP), z: c.p.z + c.d.z * (len / 2 + GAP) };
  c.p = { x: c.p.x + c.d.x * (len + GAP), z: c.p.z + c.d.z * (len + GAP) };
  return { center, rot: angleOf(c.d) + (double ? Math.PI / 2 : 0) };
}

/** Demi-taille d'une pierre posée, en x et en z. */
export function extent(t: { rot: number }): { hx: number; hz: number } {
  const alongX = Math.abs(Math.cos(t.rot)) > 0.5;
  return alongX ? { hx: 1, hz: 0.5 } : { hx: 0.5, hz: 1 };
}

/**
 * @param halfW demi-largeur de la zone où la chaîne a le droit d'aller (unités de la chaîne).
 */
export function layoutChain(chain: PlacedTile[], chainStart: number, halfW: number): ChainLayout {
  const tiles: Placement[] = [];
  const start = Math.min(Math.max(chainStart, 0), Math.max(chain.length - 1, 0));
  const first = chain[start];
  const right: Cursor = { p: { x: 0, z: 0 }, d: { x: 1, z: 0 }, turns: 0, arm: "right" };
  const left: Cursor = { p: { x: 0, z: 0 }, d: { x: -1, z: 0 }, turns: 0, arm: "left" };
  if (first) {
    const double = first.left === first.right;
    const half = double ? 0.5 : 1;
    tiles.push({ tile: first.tile, x: 0, z: 0, rot: double ? Math.PI / 2 : 0, a: first.left, b: first.right, double, index: start });
    right.p = { x: half, z: 0 };
    left.p = { x: -half, z: 0 };
  }
  // Bras droit : les pierres après la première. Leur côté « left » touche la précédente.
  for (let i = start + 1; i < chain.length; i++) {
    const t = chain[i] as PlacedTile;
    const double = t.left === t.right;
    const { center, rot } = place(right, double, halfW);
    tiles.push({ tile: t.tile, x: center.x, z: center.z, rot, a: t.left, b: t.right, double, index: i });
  }
  // Bras gauche : les pierres avant la première, du centre vers le bout. Leur côté « right » touche.
  for (let i = start - 1; i >= 0; i--) {
    const t = chain[i] as PlacedTile;
    const double = t.left === t.right;
    const { center, rot } = place(left, double, halfW);
    tiles.push({ tile: t.tile, x: center.x, z: center.z, rot, a: t.right, b: t.left, double, index: i });
  }
  const ghost = (c: Cursor, end: End): Slot => {
    const copy: Cursor = { ...c, p: { ...c.p }, d: { ...c.d } };
    const { center, rot } = place(copy, false, halfW);
    return { end, x: center.x, z: center.z, rot };
  };
  const slots = first
    ? { left: ghost(left, "left"), right: ghost(right, "right") }
    : { left: { end: "left" as const, x: 0, z: 0, rot: 0 }, right: { end: "right" as const, x: 0, z: 0, rot: 0 } };

  const bounds: Bounds = { minX: -1, maxX: 1, minZ: -0.5, maxZ: 0.5 };
  for (const t of tiles) {
    const { hx, hz } = extent(t);
    bounds.minX = Math.min(bounds.minX, t.x - hx);
    bounds.maxX = Math.max(bounds.maxX, t.x + hx);
    bounds.minZ = Math.min(bounds.minZ, t.z - hz);
    bounds.maxZ = Math.max(bounds.maxZ, t.z + hz);
  }
  return { tiles, slots, bounds };
}
