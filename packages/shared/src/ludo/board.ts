/**
 * Le plateau du Ludo « Tchekchayka » : un circuit de 52 cases partagé par tout le monde, puis
 * pour chaque couleur un couloir de 5 cases qui mène au centre.
 *
 * Un pion est repéré par sa « progression » sur son propre chemin :
 *   -1        à la maison (pas encore sorti)
 *   0 à 50    sur le circuit (0 = sa case de départ)
 *   51 à 55   dans son couloir de couleur (personne d'autre n'y entre)
 *   56        arrivé au centre
 */

export const LUDO_COLORS = ["red", "green", "yellow", "blue"] as const;
export type LudoColor = (typeof LUDO_COLORS)[number];

export const TRACK_LENGTH = 52;
export const LAST_TRACK_STEP = 50;
export const FINISH_STEP = 56;
export const BASE_STEP = -1;
export const PAWNS_PER_PLAYER = 4;

/** Case de départ de chaque couleur sur le circuit (dans le sens des aiguilles d'une montre). */
export const START_INDEX: Record<LudoColor, number> = { red: 0, green: 13, yellow: 26, blue: 39 };

/** Cases étoilées, où personne n'est mangé : les 4 cases de départ et les 4 étoiles. */
export const SAFE_TRACK_INDEXES: readonly number[] = [0, 8, 13, 21, 26, 34, 39, 47];

/** Case du circuit (0 à 51) où se trouve un pion, ou null s'il est à la maison, dans son couloir ou arrivé. */
export function trackIndexOf(color: LudoColor, step: number): number | null {
  if (step < 0 || step > LAST_TRACK_STEP) return null;
  return (START_INDEX[color] + step) % TRACK_LENGTH;
}

export function isSafeTrackIndex(index: number): boolean {
  return SAFE_TRACK_INDEXES.includes(index);
}

/** Couleurs selon le nombre de joueurs : à 2, face à face (rouge et jaune). */
export function colorsFor(players: number): LudoColor[] {
  if (players === 2) return ["red", "yellow"];
  if (players === 3) return ["red", "green", "yellow"];
  return ["red", "green", "yellow", "blue"];
}
