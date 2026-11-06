import type { LudoState } from "./rules.ts";

/**
 * Ce que tout le monde à la table peut voir. Au Ludo, rien n'est caché (pas de main, pas de
 * pioche) : la vue publique est l'état de la partie. Seul le tirage du dé reste au serveur.
 */
export type LudoPublicView = LudoState;

export function ludoPublicView(state: LudoState): LudoPublicView {
  return {
    ...state,
    options: { ...state.options },
    colors: [...state.colors],
    pawns: state.pawns.map((p) => [...p]),
    movable: [...state.movable],
    bots: [...state.bots],
    done: [...state.done],
    winners: state.winners ? [...state.winners] : null,
    events: [...state.events],
  };
}
