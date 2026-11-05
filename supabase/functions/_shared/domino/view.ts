import type { DominoOptions } from "./options.ts";
import type { DominoEvent, DominoPhase, DominoState, PlacedTile, RoundResult, Team } from "./rules.ts";
import type { TileId } from "./tiles.ts";

/**
 * Ce que tout le monde à la table peut voir. Ne contient jamais les mains ni la pioche :
 * seulement leur nombre de dominos. Chaque joueur reçoit sa propre main à part.
 */
export type DominoPublicView = {
  options: DominoOptions;
  phase: DominoPhase;
  round: number;
  chain: PlacedTile[];
  chainStart: number;
  handCounts: number[];
  boneyardCount: number;
  turn: number;
  mustOpenWith: TileId | null;
  /** Qui peut ouvrir la manche (le gagnant ou son partenaire). Vide une fois la manche ouverte. */
  openers: number[];
  scores: [number, number];
  lastResult: RoundResult | null;
  winnerTeam: Team | null;
  events: DominoEvent[];
  eventSeq: number;
  deadline: number | null;
};

export function publicView(state: DominoState): DominoPublicView {
  // À la fin d'une manche, les mains restantes sont montrées à tous (comme sur une vraie table).
  const lastResult = state.phase === "playing" ? null : state.lastResult;
  return {
    options: state.options,
    phase: state.phase,
    round: state.round,
    chain: state.chain,
    chainStart: state.chainStart ?? 0,
    handCounts: state.hands.map((h) => h.length),
    boneyardCount: state.boneyard.length,
    turn: state.turn,
    mustOpenWith: state.mustOpenWith,
    openers: state.openers ?? [],
    scores: state.scores,
    lastResult,
    winnerTeam: state.winnerTeam,
    events: state.events,
    eventSeq: state.eventSeq,
    deadline: state.deadline,
  };
}

/** La main d'un seul joueur, à n'envoyer qu'à lui. */
export function handOf(state: DominoState, seat: number): TileId[] {
  return [...(state.hands[seat] ?? [])];
}
