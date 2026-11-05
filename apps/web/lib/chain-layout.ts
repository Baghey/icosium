import type { End, PlacedTile } from "@icosium/shared";

/**
 * Place la chaîne de dominos sur la table, comme sur une vraie table : elle part du premier
 * domino posé, au centre, et chaque bout avance tout droit puis tourne au bord, sans jamais
 * se couper. Unités : un domino fait 1 de large et 2 de long. x vers la droite, z vers le joueur.
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

type Vec = { x: number; z: number };
const GAP = 0.06;
const angleOf = (d: Vec) => Math.atan2(-d.z, d.x);

/** Le bras droit tourne vers le joueur, le bras gauche vers le haut : la chaîne forme un S. */
function turn(d: Vec, arm: End, rowsTurned: number): Vec {
  // En revenant d'un tour vertical, une rangée sur deux repart en sens inverse.
  const reversed = ((rowsTurned + 1) / 2) % 2 === 1;
  if (d.z !== 0) return { x: reversed ? (arm === "right" ? -1 : 1) : arm === "right" ? 1 : -1, z: 0 };
  return { x: 0, z: arm === "right" ? 1 : -1 };
}

type Cursor = { p: Vec; d: Vec; turns: number; arm: End };

function place(c: Cursor, double: boolean, limitX: number): { center: Vec; rot: number; along: boolean } {
  const vertical = c.d.z !== 0;
  const len = double ? 1 : 2;
  const tooFar = !vertical && Math.abs(c.p.x + c.d.x * (len + GAP)) > limitX;
  if (vertical || tooFar) {
    // Le domino qui tourne se pose en long dans la nouvelle direction, collé au précédent.
    const nd = turn(c.d, c.arm, c.turns);
    const center = { x: c.p.x + c.d.x * (0.5 + GAP) + nd.x * (1 - 0.5), z: c.p.z + c.d.z * (0.5 + GAP) + nd.z * (1 - 0.5) };
    c.p = { x: c.p.x + c.d.x * (0.5 + GAP) + nd.x * (2 - 0.5 + GAP), z: c.p.z + c.d.z * (0.5 + GAP) + nd.z * (2 - 0.5 + GAP) };
    c.d = nd;
    c.turns += 1;
    return { center, rot: angleOf(nd), along: true };
  }
  const center = { x: c.p.x + c.d.x * (len / 2 + GAP), z: c.p.z + c.d.z * (len / 2 + GAP) };
  c.p = { x: c.p.x + c.d.x * (len + GAP), z: c.p.z + c.d.z * (len + GAP) };
  return { center, rot: angleOf(c.d) + (double ? Math.PI / 2 : 0), along: !double };
}

export function layoutChain(chain: PlacedTile[], chainStart: number, limitX: number): { tiles: Placement[]; slots: Record<End, Slot> } {
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
  // Bras droit : les dominos après le premier. Leur côté « left » touche le précédent.
  for (let i = start + 1; i < chain.length; i++) {
    const t = chain[i] as PlacedTile;
    const double = t.left === t.right;
    const { center, rot, along } = place(right, double, limitX);
    tiles.push({ tile: t.tile, x: center.x, z: center.z, rot, a: along ? t.left : t.left, b: t.right, double, index: i });
  }
  // Bras gauche : les dominos avant le premier, du centre vers le bout. Leur côté « right » touche.
  for (let i = start - 1; i >= 0; i--) {
    const t = chain[i] as PlacedTile;
    const double = t.left === t.right;
    const { center, rot } = place(left, double, limitX);
    tiles.push({ tile: t.tile, x: center.x, z: center.z, rot, a: t.right, b: t.left, double, index: i });
  }
  const ghost = (c: Cursor, end: End): Slot => {
    const copy: Cursor = { ...c, p: { ...c.p }, d: { ...c.d } };
    const { center, rot } = place(copy, false, limitX);
    return { end, x: center.x, z: center.z, rot };
  };
  const slots = first
    ? { left: ghost(left, "left"), right: ghost(right, "right") }
    : { left: { end: "left" as const, x: 0, z: 0, rot: 0 }, right: { end: "right" as const, x: 0, z: 0, rot: 0 } };
  return { tiles, slots };
}
