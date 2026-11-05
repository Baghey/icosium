/** Réglages de la table, choisis par le Patron (le créateur de la table). */
export type DominoOptions = {
  /** 2 joueurs (avec pioche) ou 4 en deux équipes. */
  players: 2 | 4;
  /** Score à atteindre pour gagner la partie. */
  targetScore: 51 | 101 | 151;
  /** Qui ouvre les manches suivantes : le gagnant de la manche, ou le double-six à chaque fois. */
  opener: "winner" | "doubleSix";
  /** Points du gagnant : mains des adversaires, ou toutes les mains (partenaire compris). */
  scoring: "opponents" | "all";
  /** Secondes par tour ; 0 = illimité (entre amis). */
  turnSeconds: 15 | 30 | 0;
  /** Les bots ne viennent que si le Patron l'autorise (jamais par défaut). */
  botAllowed: boolean;
};

export const DEFAULT_DOMINO_OPTIONS: DominoOptions = {
  players: 4,
  targetScore: 101,
  opener: "winner",
  scoring: "opponents",
  turnSeconds: 30,
  botAllowed: false,
};

/** Lit des réglages envoyés par un client et garde seulement les valeurs autorisées. */
export function parseDominoOptions(input: unknown): DominoOptions {
  const o = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
  return {
    players: pick(o.players, [2, 4] as const, DEFAULT_DOMINO_OPTIONS.players),
    targetScore: pick(o.targetScore, [51, 101, 151] as const, DEFAULT_DOMINO_OPTIONS.targetScore),
    opener: pick(o.opener, ["winner", "doubleSix"] as const, DEFAULT_DOMINO_OPTIONS.opener),
    scoring: pick(o.scoring, ["opponents", "all"] as const, DEFAULT_DOMINO_OPTIONS.scoring),
    turnSeconds: pick(o.turnSeconds, [15, 30, 0] as const, DEFAULT_DOMINO_OPTIONS.turnSeconds),
    botAllowed: o.botAllowed === true,
  };
}

/** Contrat commun des jeux d'ICOSIUM. */
export const DOMINO_GAME = {
  id: "domino",
  minPlayers: 2,
  maxPlayers: 4,
  botAllowed: false,
} as const;
