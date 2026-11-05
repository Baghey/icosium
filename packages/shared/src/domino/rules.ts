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
  | { type: "roundStart"; round: number; opener: Seat }
  /** Donne annulée et refaite : 6 doubles dans une main, ou « Redéclarer » après 6 pierres d'une famille. */
  | { type: "redeal"; reason: "sixDoubles" | "family"; seat: Seat }
  /** Un joueur a reçu 6 pierres d'une même famille : il choisit de redéclarer ou de garder. */
  | { type: "declare"; seat: Seat; family: number }
  | { type: "keep"; seat: Seat; family: number };

export type RoundResult = {
  round: number;
  reason: "closed" | "blocked";
  /** Équipe gagnante, ou null si la manche est nulle (partie bloquée à égalité). */
  winnerTeam: Team | null;
  points: number;
  closedBy: Seat | null;
  /** L'équipe gagnante avait gardé une donne « 6 pierres d'une famille » : ses points sont partis aux adversaires. */
  penalized?: boolean;
  handValues: number[];
  teamValues: [number, number];
  /** Mains restantes, révélées à la fin de la manche. */
  hands: TileId[][];
};

/** « declare » : la manche attend le choix du joueur qui a reçu 6 pierres d'une même famille. */
export type DominoPhase = "declare" | "playing" | "roundOver" | "gameOver";

/** Choix en attente après une donne de 6 pierres d'une même famille. */
export type FamilyDeal = { seat: Seat; family: number };

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
  /** Chaises tenues par un bot (seulement si le Patron l'a voulu). */
  bots?: Seat[];
  /** Donne « 6 pierres d'une famille » en attente de choix. */
  declare?: FamilyDeal | null;
  /** Équipe qui a gardé une donne « 6 pierres d'une famille » : elle ne marque rien sur la manche. */
  penaltyTeam?: Team | null;
  /** Chiffres que chaque joueur n'avait pas (il a passé ou pioché dessus). Information publique. */
  misses?: number[][];
  events: DominoEvent[];
  eventSeq: number;
  /** Heure limite du tour en cours (ms), ou de la pause entre deux manches. Null = illimité. */
  deadline: number | null;
};

export type DominoAction = { type: "play"; tile: TileId; end: End };

export type DominoError = "not_playing" | "not_your_turn" | "tile_not_in_hand" | "illegal_move" | "not_due" | "not_your_choice";

export type ActionResult = { ok: true; state: DominoState } | { ok: false; error: DominoError };

export const HAND_SIZE = 7;
/** Au-delà de ce score, l'équipe gagnante choisit qui ouvre la manche suivante. */
export const CONSULT_AFTER_POINTS = 50;
/** Pause entre deux manches avant que la suivante démarre seule. */
export const ROUND_BREAK_MS = 12_000;
/** Temps de réflexion d'un bot, pour que la partie reste lisible. */
export const BOT_DELAY_MS = 1_100;
/** Temps laissé pour choisir « Redéclarer » ou « Garder ». Passé ce délai, on redistribue. */
export const DECLARE_MS = 20_000;
/** Nombre de doubles dans une main qui annule la donne. */
export const SIX_DOUBLES = 6;
/** Nombre de pierres d'une même famille qui ouvre le choix « Redéclarer / Garder ». */
export const FAMILY_TILES = 6;

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

function isBot(state: DominoState, seat: Seat): boolean {
  return (state.bots ?? []).includes(seat);
}

function turnDeadline(state: DominoState, seat: Seat, now: number): number | null {
  if (isBot(state, seat)) return now + BOT_DELAY_MS;
  return state.options.turnSeconds > 0 ? now + state.options.turnSeconds * 1000 : null;
}

/** Nombre de doubles dans une main. */
export function doublesIn(hand: readonly TileId[]): number {
  return hand.filter(isDouble).length;
}

/** La famille (chiffre) dont la main contient au moins 6 pierres, ou null. */
export function familyOf(hand: readonly TileId[]): number | null {
  for (let n = 0; n <= 6; n++) {
    if (hand.filter((t) => parseTile(t).includes(n)).length >= FAMILY_TILES) return n;
  }
  return null;
}

function cloneState(state: DominoState): DominoState {
  return {
    ...state,
    hands: state.hands.map((h) => [...h]),
    boneyard: [...state.boneyard],
    chain: [...state.chain],
    misses: (state.misses ?? []).map((m) => [...m]),
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

function dealRound(state: DominoState, rng: Rng, now: number, round: number, redeal?: DominoEvent): DominoState {
  const players = state.options.players;
  const events: DominoEvent[] = redeal ? [redeal] : [];
  let hands: TileId[][] = [];
  let boneyard: TileId[] = [];
  // On mélange et on distribue. Une main avec 6 doubles annule la donne : on recommence.
  for (;;) {
    const deck = shuffle(fullSet(), rng);
    hands = [];
    for (let s = 0; s < players; s++) hands.push(deck.slice(s * HAND_SIZE, (s + 1) * HAND_SIZE));
    boneyard = deck.slice(players * HAND_SIZE);
    const unlucky = hands.findIndex((h) => doublesIn(h) >= SIX_DOUBLES);
    if (unlucky < 0) break;
    events.push({ type: "redeal", reason: "sixDoubles", seat: unlucky });
  }

  const useForced = round === 1 || state.options.opener === "doubleSix" || state.nextOpener === null;
  const forced = useForced ? forcedOpener(hands) : null;
  const opener = forced ? forced.seat : (state.nextOpener as Seat);
  const winnerTeam = state.lastResult?.winnerTeam ?? null;
  // Dès que l'équipe gagnante a dépassé 50 points, le gagnant et son partenaire peuvent se
  // concerter (« ytchawro ») : l'un ou l'autre ouvre. Avant, c'est le gagnant lui-même.
  const canConsult = winnerTeam !== null && state.scores[winnerTeam] > CONSULT_AFTER_POINTS;
  const openers =
    !forced && players === 4 && canConsult && teamOf(opener) === winnerTeam ? [opener, (opener + 2) % 4] : [opener];
  events.push({ type: "roundStart", round, opener });

  const next: DominoState = {
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
    openers,
    declare: null,
    penaltyTeam: null,
    misses: hands.map(() => []),
    events,
    eventSeq: state.eventSeq + 1,
    deadline: null,
  };

  // 6 pierres d'une même famille : la manche attend que le joueur choisisse.
  const seat = hands.findIndex((h) => familyOf(h) !== null);
  if (seat >= 0) {
    const family = familyOf(hands[seat] as TileId[]) as number;
    next.phase = "declare";
    next.declare = { seat, family };
    next.events.push({ type: "declare", seat, family });
    next.deadline = now + (isBot(next, seat) ? BOT_DELAY_MS : DECLARE_MS);
    return next;
  }
  next.deadline = turnDeadline(next, opener, now);
  return next;
}

/** Crée une partie et distribue la première manche. */
export function createDominoGame(options: DominoOptions, rng: Rng, now: number, bots: readonly Seat[] = []): DominoState {
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
    bots: [...bots],
    declare: null,
    penaltyTeam: null,
    misses: [],
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

  // L'équipe qui a gardé une donne « 6 pierres d'une famille » ne marque rien : ses points vont aux adversaires.
  let penalized = false;
  const penaltyTeam = state.penaltyTeam ?? null;
  if (winnerTeam !== null && penaltyTeam === winnerTeam) {
    winnerTeam = winnerTeam === 0 ? 1 : 0;
    penalized = true;
  }

  const scores = [...state.scores] as [number, number];
  if (winnerTeam !== null) scores[winnerTeam] += points;

  // Qui ouvrira la manche suivante si la règle est « le gagnant de la manche ».
  // Égalité au blocage : personne n'a gagné, la manche est rejouée et le double-six rouvre (null).
  let nextOpener: Seat | null;
  if (winnerTeam === null) nextOpener = null;
  else if (closedBy !== null && !penalized) nextOpener = closedBy;
  else {
    const members = Array.from({ length: players }, (_, s) => s).filter((s) => teamOf(s) === winnerTeam);
    nextOpener = members.reduce((best, s) => ((handValues[s] ?? 0) < (handValues[best] ?? 0) ? s : best));
  }

  const result: RoundResult = {
    round: state.round,
    reason,
    winnerTeam,
    points,
    closedBy,
    ...(penalized ? { penalized: true } : {}),
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
    noteMiss(state, seat);
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
  state.deadline = turnDeadline(state, seat, now);
  return state;
}

/** Retient que ce joueur n'avait aucun des deux bouts (tout le monde l'a vu passer ou piocher). */
function noteMiss(state: DominoState, seat: Seat) {
  const ends = chainEnds(state.chain);
  if (!ends) return;
  const misses = (state.misses ??= []);
  while (misses.length <= seat) misses.push([]);
  const mine = misses[seat] as number[];
  for (const n of [ends.left, ends.right]) if (!mine.includes(n)) mine.push(n);
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
  // Manche nulle (blocage à égalité) : elle est rejouée, avec le même numéro.
  const replay = state.lastResult !== null && state.lastResult.winnerTeam === null;
  return { ok: true, state: dealRound(cloneState(state), rng, now, replay ? state.round : state.round + 1) };
}

/**
 * Le joueur qui a reçu 6 pierres d'une même famille choisit :
 * « redeclare » : on mélange et on redistribue ; « keep » : on joue, mais son équipe ne marquera rien.
 */
export function chooseFamilyDeal(state: DominoState, seat: Seat, choice: "redeclare" | "keep", rng: Rng, now: number): ActionResult {
  if (state.phase !== "declare" || !state.declare) return { ok: false, error: "not_playing" };
  if (state.declare.seat !== seat) return { ok: false, error: "not_your_choice" };
  const { family } = state.declare;
  const next = cloneState(state);
  next.eventSeq = state.eventSeq + 1;
  if (choice === "redeclare") {
    return { ok: true, state: dealRound(next, rng, now, state.round, { type: "redeal", reason: "family", seat }) };
  }
  next.phase = "playing";
  next.declare = null;
  next.penaltyTeam = teamOf(seat);
  next.events.push({ type: "keep", seat, family });
  next.deadline = turnDeadline(next, next.turn, now);
  return { ok: true, state: next };
}

/**
 * Le coup d'un bot. Il ne voit que ce qu'un joueur verrait : sa main, la table, et les chiffres
 * que chacun n'avait pas (passes et pioches). Il se débarrasse des grosses pierres et des doubles,
 * garde de quoi rejouer, bloque les adversaires sur leurs chiffres manquants et ménage son partenaire.
 */
export function chooseBotMove(state: DominoState, seat: Seat): { tile: TileId; end: End } | null {
  const moves = legalMoves(state, seat);
  if (moves.length <= 1) return moves[0] ?? null;
  const hand = state.hands[seat] ?? [];
  const players = state.options.players;
  const partner = players === 4 ? (seat + 2) % 4 : null;
  const opponents = Array.from({ length: players }, (_, s) => s).filter((s) => teamOf(s) !== teamOf(seat));
  const misses = state.misses ?? [];
  const ends = chainEnds(state.chain);

  let best = moves[0] as { tile: TileId; end: End };
  let bestScore = -Infinity;
  for (const move of moves) {
    const [a, b] = parseTile(move.tile);
    let newEnds: [number, number];
    if (!ends) newEnds = [a, b];
    else if (move.end === "left") newEnds = [a === ends.left ? b : a, ends.right];
    else newEnds = [ends.left, a === ends.right ? b : a];
    const rest = hand.filter((t) => t !== move.tile);
    if (rest.length === 0) return move; // il ferme : rien de mieux

    let score = tileValue(move.tile) + (a === b ? 6 : 0);
    // Garder la main : combien de mes pierres iront encore sur les nouveaux bouts.
    score += 3 * rest.filter((t) => parseTile(t).some((n) => newEnds.includes(n))).length;
    // Chiffres déjà sortis (table + ma main) : les adversaires ont peu de chances de les avoir.
    const visible = [...state.chain.map((p) => p.tile), ...rest];
    for (const n of new Set(newEnds)) {
      score += 0.8 * visible.filter((t) => parseTile(t).includes(n)).length;
      for (const o of opponents) if (misses[o]?.includes(n)) score += 5;
      if (partner !== null && misses[partner]?.includes(n)) score -= 4;
    }
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

/**
 * Temps écoulé : le serveur joue à la place du joueur le premier domino possible,
 * ou lance la manche suivante si la pause est finie. Ne fait rien avant l'heure limite.
 */
export function applyTimeout(state: DominoState, rng: Rng, now: number): ActionResult {
  if (state.deadline === null || now < state.deadline) return { ok: false, error: "not_due" };
  if (state.phase === "roundOver") return startNextRound(state, rng, now);
  // Personne n'a choisi (ou c'est un bot) : la donne déséquilibrée est refaite.
  if (state.phase === "declare" && state.declare) return chooseFamilyDeal(state, state.declare.seat, "redeclare", rng, now);
  if (state.phase !== "playing") return { ok: false, error: "not_playing" };
  const move = isBot(state, state.turn) ? chooseBotMove(state, state.turn) : legalMoves(state, state.turn)[0];
  if (!move) return { ok: false, error: "illegal_move" }; // impossible : advance garantit un coup
  return play(state, state.turn, { type: "play", tile: move.tile, end: move.end }, now, !isBot(state, state.turn));
}
