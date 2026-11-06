/** Réglages d'une table de Ludo, choisis par le Patron (le créateur de la table). */
export type LudoOptions = {
  /** 2 à 4 joueurs. */
  players: 2 | 3 | 4;
  /** À 4 seulement : deux équipes, partenaires face à face (rouge + jaune contre vert + bleu). */
  teams: boolean;
  /** Combien de pions il faut rentrer au centre pour gagner. */
  pawnsToWin: 1 | 2 | 3 | 4;
  /** Secondes par action (lancer ou bouger) ; 0 = illimité (entre amis). */
  turnSeconds: 15 | 30 | 0;
  /** Les bots ne viennent que si le Patron l'autorise (jamais par défaut). */
  botAllowed: boolean;
};

export const DEFAULT_LUDO_OPTIONS: LudoOptions = {
  players: 4,
  teams: false,
  pawnsToWin: 4,
  turnSeconds: 15,
  botAllowed: false,
};

/** Lit des réglages envoyés par un client et garde seulement les valeurs autorisées. */
export function parseLudoOptions(input: unknown): LudoOptions {
  const o = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
  const players = pick(o.players, [2, 3, 4] as const, DEFAULT_LUDO_OPTIONS.players);
  return {
    players,
    teams: players === 4 && o.teams === true,
    pawnsToWin: pick(o.pawnsToWin, [1, 2, 3, 4] as const, DEFAULT_LUDO_OPTIONS.pawnsToWin),
    turnSeconds: pick(o.turnSeconds, [15, 30, 0] as const, DEFAULT_LUDO_OPTIONS.turnSeconds),
    botAllowed: o.botAllowed === true,
  };
}

/** Contrat commun des jeux d'ICOSIUM. */
export const LUDO_GAME = {
  id: "ludo",
  minPlayers: 2,
  maxPlayers: 4,
  botAllowed: false,
} as const;
