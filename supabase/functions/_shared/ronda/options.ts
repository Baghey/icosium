/** Réglages d'une table de Ronda, choisis par le Patron (le créateur de la table). */
export type RondaOptions = {
  /** 2 joueurs, ou 4 en deux équipes (partenaires face à face). */
  players: 2 | 4;
  /** Points pour gagner : 41 (classique) ou 25 (partie courte). */
  target: 41 | 25;
  /** Secondes par carte ; 0 = illimité (entre amis). */
  turnSeconds: 15 | 30 | 0;
  /** Les bots ne viennent que si le Patron l'autorise (jamais par défaut). */
  botAllowed: boolean;
};

export const DEFAULT_RONDA_OPTIONS: RondaOptions = {
  players: 4,
  target: 41,
  turnSeconds: 30,
  botAllowed: false,
};

/** Lit des réglages envoyés par un client et garde seulement les valeurs autorisées. */
export function parseRondaOptions(input: unknown): RondaOptions {
  const o = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
  return {
    players: pick(o.players, [2, 4] as const, DEFAULT_RONDA_OPTIONS.players),
    target: pick(o.target, [41, 25] as const, DEFAULT_RONDA_OPTIONS.target),
    turnSeconds: pick(o.turnSeconds, [15, 30, 0] as const, DEFAULT_RONDA_OPTIONS.turnSeconds),
    botAllowed: o.botAllowed === true,
  };
}

/** Contrat commun des jeux d'ICOSIUM. */
export const RONDA_GAME = {
  id: "ronda",
  minPlayers: 2,
  maxPlayers: 4,
  botAllowed: false,
} as const;
