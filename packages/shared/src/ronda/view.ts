import type { RondaCard } from "./cards.ts";
import type { RondaState } from "./rules.ts";

/**
 * Ce que tout le monde à la table peut voir : la table, le nombre de cartes de chacun, les tas
 * ramassés, les scores et les annonces. Jamais les mains, ni la pioche, ni les mains de départ
 * (qui servent à vérifier les annonces) : chacun reçoit sa propre main à part.
 */
export type RondaPublicView = Omit<RondaState, "deck" | "hands" | "dealt" | "piles"> & {
  handCounts: number[];
  deckCount: number;
  pileCounts: [number, number];
  /** Les dernières cartes ramassées par chaque équipe (le dessus du tas, visible de tous). */
  pileTops: [RondaCard[], RondaCard[]];
};

export function rondaPublicView(state: RondaState): RondaPublicView {
  const { deck, hands, dealt, piles, ...rest } = state;
  void dealt;
  return {
    ...rest,
    options: { ...state.options },
    table: [...state.table],
    scores: [...state.scores],
    lastPlay: state.lastPlay ? { ...state.lastPlay } : null,
    streak: state.streak ? { ...state.streak, cards: [...state.streak.cards] } : null,
    announced: [...state.announced],
    played: [...state.played],
    bots: [...state.bots],
    events: state.events.map((e) => ({ ...e })),
    handCounts: hands.map((h) => h.length),
    deckCount: deck.length,
    pileCounts: [piles[0].length, piles[1].length],
    pileTops: [piles[0].slice(-3), piles[1].slice(-3)],
  };
}

/** La main d'un joueur, à envoyer à lui seul. */
export function rondaHandOf(state: RondaState, seat: number): RondaCard[] {
  return [...(state.hands[seat] ?? [])];
}
