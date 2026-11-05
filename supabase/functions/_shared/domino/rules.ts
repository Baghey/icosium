/**
 * Règles du domino algérien double-six (voir docs/ICOSIUM.md).
 * Fonctions pures : aucun réseau, aucune interface. Le serveur les appelle pour valider chaque coup.
 */
import type { DominoOptions } from "./options.ts";
import { type Rng, type TileId, fullSet, handValue, isDouble, parseTile, shuffle, tileValue } from "./tiles.ts";

export type Seat = number;
export type Team = 0 | 1;
export type End = "left" | "right";

/** Un domino posé dans la chaîne, orienté de gauche à droite. */
export type PlacedTile = { tile: TileId; left: number; right: number; seat: Seat };

/** Ce qui vient de se passer, pour les animations et les sons. Jamais d'information secrète. */
export type DominoEvent =
  | { type: "play"; seat: Seat; tile: TileId; end: End; auto: boolean; closing: boolean }
  | { type: "draw"; seat: Seat; count: number }
  | { type: "pass"; seat: Seat }
  | { type: "roundStart"; round: number; opener: Seat };

export type RoundResult = {
  round: number;
  reason: "closed" | "blocked";
  /** Équipe gagnante, ou null si la manche est nulle (partie bloquée à égalité). */
  winnerTeam: Team | null;
  points: number;
  closedBy: Seat | null;
  handValues: number[];
  teamValues: [number, number];
  /** Mains restantes, révélées à la fin de la manche. */
  hands: TileId[][];
};

export type DominoPhase = "playing" | "roundOver" | "gameOver";

export type DominoState = {
  options: DominoOptions;
  phase: DominoPhase;
  round: number;
  hands: TileId[][];
  boneyard: TileId[];
  chain: PlacedTile[];
  /** Position dans la chaîne du premier domino posé (pour que la chaîne reste fixe à l'écran). */
  chainStart: number;
  turn: Seat;
  passesInRow: number;
  /** Domino imposé pour ouvrir la manche (le double-six à la première manche). */
  mustOpenWith: TileId | null;
  scores: [number, number];
  roundOpener: Seat;
  /** Qui ouvrira la manche suivante (règle « gagnant de la manche »). */
  nextOpener: Seat | null;
  /**
   * Qui peut poser le premier domino de la manche. Après une manche gagnée à 4, l'équipe
   * gagnante se concerte (« ytchawro ») : le gagnant ou son partenaire ouvre.
   */
  openers: Seat[];
  lastResult: RoundResult | null;
  winnerTeam: Team | null;
  events: DominoEvent[];
  eventSeq: number;
  /** Heure limite du tour en cours (ms), ou de la pause entre deux manches. Null = illimité. */
  deadline: number | null;
};

export type DominoAction = { type: "play"; tile: TileId; end: End };

export type DominoError = "not_playing" | "not_your_turn" | "tile_not_in_hand" | "illegal_move" | "not_due";

export type ActionResult = { ok: true; state: DominoState } | { ok: false; error: DominoError };

export const HAND_SIZE = 7;
/** Au-delà de ce score, l'équipe gagnante choisit qui ouvre la manche suivante. */
export const CONSULT_AFTER_POINTS = 50;
/** Pause entre deux manches avant que la suivante démarre seule. */
export const ROUND_BREAK_MS = 12_000;

export function teamOf(seat: Seat): Team {
  return (seat % 2) as Team;
}

export function nextSeat(seat: Seat, players: number): Seat {
  return (seat + 1) % players;
}

export function chainEnds(chain: readonly PlacedTile[]): { left: number; right: number } | null {
  const first = chain[0];
  const last = chain[chain.length - 1];
  if (!first || !last) return null;
  return { left: first.left, right: last.right };
}

/** Bouts où ce domino peut être posé. Chaîne vide : un seul emplacement, noté "right". */
export function playableEnds(tile: TileId, chain: readonly PlacedTile[], mustOpenWith: TileId | null): End[] {
  const ends = chainEnds(chain);
  if (!ends) return mustOpenWith === null || mustOpenWith === tile ? ["right"] : [];
  const [a, b] = parseTile(tile);
  const out: End[] = [];
  if (a === ends.left || b === ends.left) out.push("left");
  if (a === ends.right || b === ends.right) out.push("right");
  return out;
}

export function legalMoves(state: DominoState, seat: Seat): { tile: TileId; end: End }[] {
  if (state.phase !== "playing") return [];
  const hand = state.hands[seat] ?? [];
  return hand.flatMap((tile) => playableEnds(tile, state.chain, state.mustOpenWith).map((end) => ({ tile, end })));
}

function hasMove(state: DominoState, seat: Seat): boolean {
  const hand = state.hands[seat] ?? [];
  return hand.some((t) => playableEnds(t, state.chain, state.mustOpenWith).length > 0);
}

function turnDeadline(options: DominoOptions, now: number): number | null {
  return options.turnSeconds > 0 ? now + options.turnSeconds * 1000 : null;
}

function cloneState(state: DominoState): DominoState {
  return {
    ...state,
    hands: state.hands.map((h) => [...h]),
    boneyard: [...state.boneyard],
    chain: [...state.chain],
    scores: [...state.scores] as [number, number],
    events: [],
  };
}

/** Domino d'ouverture imposé : le plus gros double en main, sinon le domino le plus fort. */
function forcedOpener(hands: TileId[][]): { seat: Seat; tile: TileId } {
  let best: { seat: Seat; tile: TileId; score: number } | null = null;
  hands.forEach((hand, seat) => {
    for (const tile of hand) {
      // Un double passe toujours avant un domino simple.
      const score = (isDouble(tile) ? 100 : 0) + tileValue(tile);
      if (!best || score > best.score) best = { seat, tile, score };
    }
  });
  if (!best) throw new Error("no tiles dealt");
  const { seat, tile } = best;
  return { seat, tile };
}

function dealRound(state: DominoState, rng: Rng, now: number, round: number): DominoState {
  const players = state.options.players;
  const deck = shuffle(fullSet(), rng);
  const hands: TileId[][] = [];
  for (let s = 0; s < players; s++) hands.push(deck.slice(s * HAND_SIZE, (s + 1) * HAND_SIZE));
  const boneyard = deck.slice(players * HAND_SIZE);

  const useForced = round === 1 || state.options.opener === "doubleSix" || state.nextOpener === null;
  const forced = useForced ? forcedOpener(hands) : null;
  const opener = forced ? forced.seat : (state.nextOpener as Seat);
  const winnerTeam = state.lastResult?.winnerTeam ?? null;
  // Dès que l'équipe gagnante a dépassé 50 points, le gagnant et son partenaire peuvent se
  // concerter (« ytchawro ») : l'un ou l'autre ouvre. Avant, c'est le gagnant lui-même.
  const canConsult = winnerTeam !== null && state.scores[winnerTeam] > CONSULT_AFTER_POINTS;
  const openers =
    !forced && players === 4 && canConsult && teamOf(opener) === winnerTeam ? [opener, (opener + 2) % 4] : [opener];

  return {
    ...state,
    phase: "playing",
    round,
    hands,
    boneyard,
    chain: [],
    chainStart: 0,
    turn: opener,
    passesInRow: 0,
    mustOpenWith: forced ? forced.tile : null,
    roundOpener: opener,
    nextOpener: null,
    openers,
    events: [{ type: "roundStart", round, opener }],
    eventSeq: state.eventSeq + 1,
    deadline: turnDeadline(state.options, now),
  };
}

/** Crée une partie et distribue la première manche. */
export function createDominoGame(options: DominoOptions, rng: Rng, now: number): DominoState {
  const empty: DominoState = {
    options,
    phase: "playing",
    round: 0,
    hands: [],
    boneyard: [],
    chain: [],
    chainStart: 0,
    turn: 0,
    passesInRow: 0,
    mustOpenWith: null,
    scores: [0, 0],
    roundOpener: 0,
    nextOpener: null,
    openers: [],
    lastResult: null,
    winnerTeam: null,
    events: [],
    eventSeq: 0,
    deadline: null,
  };
  return dealRound(empty, rng, now, 1);
}

function endRound(state: DominoState, reason: "closed" | "blocked", closedBy: Seat | null, now: number): DominoState {
  const { players, scoring, targetScore } = state.options;
  const handValues = state.hands.map((h) => handValue(h));
  const teamValues: [number, number] = [0, 0];
  handValues.forEach((v, seat) => (teamValues[teamOf(seat)] += v));
  const allHands = teamValues[0] + teamValues[1];

  let winnerTeam: Team | null;
  let points: number;
  if (reason === "closed" && closedBy !== null) {
    winnerTeam = teamOf(closedBy);
    const opponents = teamValues[winnerTeam === 0 ? 1 : 0];
    points = scoring === "all" ? allHands : opponents;
  } else if (teamValues[0] === teamValues[1]) {
    winnerTeam = null; // égalité : manche nulle
    points = 0;
  } else {
    winnerTeam = teamValues[0] < teamValues[1] ? 0 : 1;
    const loser = teamValues[winnerTeam === 0 ? 1 : 0];
    points = scoring === "all" ? allHands : loser;
  }

  const scores = [...state.scores] as [number, number];
  if (winnerTeam !== null) scores[winnerTeam] += points;

  // Qui ouvrira la manche suivante si la règle est « le gagnant de la manche ».
  let nextOpener: Seat;
  if (closedBy !== null) nextOpener = closedBy;
  else if (winnerTeam !== null) {
    const members = Array.from({ length: players }, (_, s) => s).filter((s) => teamOf(s) === winnerTeam);
    nextOpener = members.reduce((best, s) => ((handValues[s] ?? 0) < (handValues[best] ?? 0) ? s : best));
  } else nextOpener = state.roundOpener;

  const result: RoundResult = {
    round: state.round,
    reason,
    winnerTeam,
    points,
    closedBy,
    handValues,
    teamValues,
    hands: state.hands.map((h) => [...h]),
  };
  const gameOver = winnerTeam !== null && scores[winnerTeam] >= targetScore;
  return {
    ...state,
    phase: gameOver ? "gameOver" : "roundOver",
    scores,
    nextOpener,
    lastResult: result,
    winnerTeam: gameOver ? winnerTeam : null,
    deadline: gameOver ? null : now + ROUND_BREAK_MS,
  };
}

/**
 * Passe la main au joueur suivant qui peut jouer. À 2 joueurs, on pioche jusqu'à pouvoir jouer ;
 * sans domino jouable (et pioche vide), on passe. Si tout le monde passe, la partie est bloquée.
 */
function advance(state: DominoState, from: Seat, now: number): DominoState {
  const players = state.options.players;
  let seat = from;
  for (;;) {
    seat = nextSeat(seat, players);
    if (hasMove(state, seat)) break;
    let drawn = 0;
    while (state.boneyard.length > 0 && !hasMove(state, seat)) {
      (state.hands[seat] as TileId[]).push(state.boneyard.shift() as TileId);
      drawn++;
    }
    if (drawn > 0) state.events.push({ type: "draw", seat, count: drawn });
    if (hasMove(state, seat)) break;
    state.events.push({ type: "pass", seat });
    state.passesInRow += 1;
    if (state.passesInRow >= players) return endRound(state, "blocked", null, now);
  }
  state.turn = seat;
  state.deadline = turnDeadline(state.options, now);
  return state;
}

function play(state: DominoState, seat: Seat, action: DominoAction, now: number, auto: boolean): ActionResult {
  if (state.phase !== "playing") return { ok: false, error: "not_playing" };
  const opening = state.chain.length === 0 && (state.openers ?? []).includes(seat);
  if (seat !== state.turn && !opening) return { ok: false, error: "not_your_turn" };
  const hand = state.hands[seat] ?? [];
  if (!hand.includes(action.tile)) return { ok: false, error: "tile_not_in_hand" };
  if (!playableEnds(action.tile, state.chain, state.mustOpenWith).includes(action.end)) {
    return { ok: false, error: "illegal_move" };
  }

  const next = cloneState(state);
  next.eventSeq = state.eventSeq + 1;
  next.hands[seat] = (next.hands[seat] as TileId[]).filter((t) => t !== action.tile);
  const [a, b] = parseTile(action.tile);
  const ends = chainEnds(next.chain);
  if (!ends) {
    next.chain.push({ tile: action.tile, left: a, right: b, seat });
  } else if (action.end === "left") {
    // Le côté droit du domino touche le bout gauche de la chaîne.
    const right = ends.left;
    next.chain.unshift({ tile: action.tile, left: a === right ? b : a, right, seat });
    next.chainStart = (state.chainStart ?? 0) + 1;
  } else {
    const left = ends.right;
    next.chain.push({ tile: action.tile, left, right: a === left ? b : a, seat });
  }
  next.mustOpenWith = null;
  next.passesInRow = 0;
  next.openers = [];
  if (opening) next.roundOpener = seat;

  const closing = (next.hands[seat] as TileId[]).length === 0;
  next.events.push({ type: "play", seat, tile: action.tile, end: action.end, auto, closing });
  if (closing) return { ok: true, state: endRound(next, "closed", seat, now) };
  return { ok: true, state: advance(next, seat, now) };
}

/** Joue un coup pour `seat`. Le serveur appelle cette fonction pour chaque action reçue. */
export function applyDominoAction(state: DominoState, seat: Seat, action: DominoAction, now: number): ActionResult {
  return play(state, seat, action, now, false);
}

/** Lance la manche suivante (après la pause de fin de manche). */
export function startNextRound(state: DominoState, rng: Rng, now: number): ActionResult {
  if (state.phase !== "roundOver") return { ok: false, error: "not_playing" };
  return { ok: true, state: dealRound(cloneState(state), rng, now, state.round + 1) };
}

/**
 * Temps écoulé : le serveur joue à la place du joueur le premier domino possible,
 * ou lance la manche suivante si la pause est finie. Ne fait rien avant l'heure limite.
 */
export function applyTimeout(state: DominoState, rng: Rng, now: number): ActionResult {
  if (state.deadline === null || now < state.deadline) return { ok: false, error: "not_due" };
  if (state.phase === "roundOver") return startNextRound(state, rng, now);
  if (state.phase !== "playing") return { ok: false, error: "not_playing" };
  const move = legalMoves(state, state.turn)[0];
  if (!move) return { ok: false, error: "illegal_move" }; // impossible : advance garantit un coup
  return play(state, state.turn, { type: "play", tile: move.tile, end: move.end }, now, true);
}
