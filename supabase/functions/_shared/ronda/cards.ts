/**
 * Le paquet de la Ronda : jeu français de 40 cartes (52 sans les 8, 9 et 10).
 * As, 2 à 7, puis Valet, Dame, Roi. Le Valet suit directement le 7. Les couleurs ne comptent pas.
 */
export const RONDA_RANKS = ["A", "2", "3", "4", "5", "6", "7", "J", "Q", "K"] as const;
export const RONDA_SUITS = ["S", "H", "C", "D"] as const;
export type RondaRank = (typeof RONDA_RANKS)[number];
export type RondaSuit = (typeof RONDA_SUITS)[number];
/** Une carte : rang puis couleur, par exemple « 5H » (5 de cœur) ou « JS » (Valet de pique). */
export type RondaCard = `${RondaRank}${RondaSuit}`;

export type RondaRng = () => number;

/** Valeur d'une carte pour les suites : As = 1 … 7 = 7, Valet = 8, Dame = 9, Roi = 10. */
export function rondaValue(card: RondaCard): number {
  return RONDA_RANKS.indexOf(card.slice(0, -1) as RondaRank) + 1;
}

export function rondaRankOf(card: RondaCard): RondaRank {
  return card.slice(0, -1) as RondaRank;
}

export function isRondaCard(x: unknown): x is RondaCard {
  if (typeof x !== "string" || x.length !== 2) return false;
  return (RONDA_RANKS as readonly string[]).includes(x[0] as string) && (RONDA_SUITS as readonly string[]).includes(x[1] as string);
}

export function rondaDeck(): RondaCard[] {
  return RONDA_RANKS.flatMap((r) => RONDA_SUITS.map((s) => `${r}${s}` as RondaCard));
}

export function shuffleRonda<T>(items: readonly T[], rng: RondaRng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
