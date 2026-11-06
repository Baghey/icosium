/**
 * Règles du Ludo « Tchekchayka » (validées par le propriétaire le 5 novembre 2026, voir docs/ICOSIUM.md).
 * Fonctions pures : aucun réseau, aucune interface. Le serveur les appelle pour valider chaque action
 * et c'est lui qui tire le dé ; la partie guidée du téléphone les appelle avec des dés préparés.
 *
 * - un pion ne sort de la maison qu'avec un 6 ;
 * - un 6 fait rejouer ; trois 6 de suite : le tour est perdu ;
 * - tomber sur un pion adverse le renvoie à sa maison, et on rejoue ;
 * - les cases étoilées sont sûres ; deux pions d'une même couleur ne forment pas de mur ;
 * - il faut le chiffre exact pour entrer au centre ;
 * - on gagne en rentrant `pawnsToWin` pions (1 à 4). En équipes, il faut que les deux partenaires
 *   y arrivent ; celui qui a fini joue ensuite les pions de son partenaire.
 */
import {
  BASE_STEP,
  FINISH_STEP,
  LAST_TRACK_STEP,
  type LudoColor,
  PAWNS_PER_PLAYER,
  TRACK_LENGTH,
  colorsFor,
  isSafeTrackIndex,
  trackIndexOf,
} from "./board.ts";
import type { LudoOptions } from "./options.ts";

export type LudoRng = () => number;
export type LudoPhase = "roll" | "move" | "over";

/** Un pion renvoyé à la maison. */
export type LudoCapture = { seat: number; pawn: number; from: number };

/** Ce qui vient de se passer, pour les animations et les sons. */
export type LudoEvent =
  | { type: "start"; first: number }
  | { type: "roll"; seat: number; value: number; auto: boolean }
  | {
      type: "move";
      /** Celui qui joue. */
      seat: number;
      /** À qui est le pion (différent en équipes, quand on joue pour son partenaire). */
      owner: number;
      pawn: number;
      from: number;
      to: number;
      captured: LudoCapture[];
      auto: boolean;
    }
  | { type: "noMove"; seat: number; value: number }
  | { type: "threeSixes"; seat: number }
  | { type: "bonus"; seat: number; reason: "six" | "capture" }
  | { type: "done"; seat: number }
  | { type: "win"; seats: number[] };

export type LudoState = {
  options: LudoOptions;
  /** Couleur de chaque chaise. */
  colors: LudoColor[];
  /** Progression de chaque pion, par chaise (voir board.ts). */
  pawns: number[][];
  /** Chaise qui a la main. */
  turn: number;
  /** Chaise dont on bouge les pions (le partenaire, en équipes, quand on a déjà fini). */
  mover: number;
  phase: LudoPhase;
  /** Dernier chiffre du dé (reste affiché). */
  die: number | null;
  /** 6 de suite dans ce tour. */
  sixes: number;
  /** Pions qui peuvent bouger avec le dé actuel (phase « move »). */
  movable: number[];
  /** Chaises tenues par un bot (seulement si le Patron l'a voulu). */
  bots: number[];
  /** Chaises qui ont rentré assez de pions, dans l'ordre. */
  done: number[];
  /** Gagnant(s) : une chaise, ou deux partenaires. */
  winners: number[] | null;
  events: LudoEvent[];
  eventSeq: number;
  /** Heure limite de l'action en cours (ms), ou null sans chrono. */
  deadline: number | null;
};

export type LudoAction = { type: "roll" } | { type: "move"; pawn: number };
export type LudoResult = { ok: true; state: LudoState } | { ok: false; error: string };

/** Temps de « réflexion » d'un bot, pour que la partie reste lisible. */
export const LUDO_BOT_DELAY_MS = 900;
/** Durées des animations, ajoutées au chrono pour que personne ne perde de temps à regarder. */
export const LUDO_DIE_MS = 650;
export const LUDO_HOP_MS = 140;
export const LUDO_CAPTURE_MS = 450;

function clone(state: LudoState): LudoState {
  return {
    ...state,
    options: { ...state.options },
    colors: [...state.colors],
    pawns: state.pawns.map((p) => [...p]),
    movable: [...state.movable],
    bots: [...state.bots],
    done: [...state.done],
    winners: state.winners ? [...state.winners] : null,
    events: [],
    eventSeq: state.eventSeq + 1,
  };
}

const playersOf = (state: LudoState) => state.colors.length;

/** Deux chaises du même camp ? (la même, ou des partenaires en équipes) */
export function areLudoAllies(state: LudoState, a: number, b: number): boolean {
  return a === b || (state.options.teams && a % 2 === b % 2);
}

export function finishedCount(pawns: readonly number[]): number {
  return pawns.filter((p) => p === FINISH_STEP).length;
}

export function isLudoDone(state: LudoState, seat: number): boolean {
  return finishedCount(state.pawns[seat] ?? []) >= state.options.pawnsToWin;
}

/** Dont on bouge les pions quand `seat` a la main. */
export function moverFor(state: LudoState, seat: number): number {
  if (state.options.teams && isLudoDone(state, seat)) return (seat + 2) % 4;
  return seat;
}

/** Où arrive un pion qui part de `from` avec `die`, ou null s'il ne peut pas bouger. */
export function targetStep(from: number, die: number): number | null {
  if (from === BASE_STEP) return die === 6 ? 0 : null;
  if (from >= FINISH_STEP) return null;
  const to = from + die;
  return to <= FINISH_STEP ? to : null; // chiffre exact pour entrer au centre
}

/** Les pions de `mover` qui peuvent bouger avec `die`. */
export function movablePawns(state: LudoState, mover: number, die: number): number[] {
  const pawns = state.pawns[mover] ?? [];
  return pawns.flatMap((from, i) => (targetStep(from, die) === null ? [] : [i]));
}

/** Les pions adverses mangés si un pion de `mover` arrive à `to`. */
export function capturesAt(state: LudoState, mover: number, to: number): LudoCapture[] {
  const index = trackIndexOf(state.colors[mover] as LudoColor, to);
  if (index === null || isSafeTrackIndex(index)) return [];
  const out: LudoCapture[] = [];
  state.pawns.forEach((pawns, seat) => {
    if (areLudoAllies(state, seat, mover)) return;
    pawns.forEach((step, pawn) => {
      if (trackIndexOf(state.colors[seat] as LudoColor, step) === index) out.push({ seat, pawn, from: step });
    });
  });
  return out;
}

function deadlineFor(state: LudoState, seat: number, now: number, extraMs: number): number | null {
  if (state.bots.includes(seat)) return now + LUDO_BOT_DELAY_MS + extraMs;
  const secs = state.options.turnSeconds;
  return secs ? now + secs * 1000 + extraMs : null;
}

export function createLudoGame(options: LudoOptions, rng: LudoRng, now: number, bots: readonly number[] = []): LudoState {
  const colors = colorsFor(options.players);
  const first = Math.min(colors.length - 1, Math.floor(rng() * colors.length));
  const state: LudoState = {
    options: { ...options, teams: options.players === 4 && options.teams },
    colors,
    pawns: colors.map(() => Array.from({ length: PAWNS_PER_PLAYER }, () => BASE_STEP)),
    turn: first,
    mover: first,
    phase: "roll",
    die: null,
    sixes: 0,
    movable: [],
    bots: [...bots],
    done: [],
    winners: null,
    events: [{ type: "start", first }],
    eventSeq: 1,
    deadline: null,
  };
  state.deadline = deadlineFor(state, first, now, 0);
  return state;
}

function endTurn(next: LudoState, now: number, extraMs: number): void {
  const turn = (next.turn + 1) % playersOf(next);
  next.turn = turn;
  next.mover = moverFor(next, turn);
  next.phase = "roll";
  next.sixes = 0;
  next.movable = [];
  next.deadline = deadlineFor(next, turn, now, extraMs);
}

function doMove(next: LudoState, pawn: number, now: number, auto: boolean): void {
  const mover = next.mover;
  const die = next.die as number;
  const from = (next.pawns[mover] as number[])[pawn] as number;
  const to = targetStep(from, die) as number;
  const captured = capturesAt(next, mover, to);
  (next.pawns[mover] as number[])[pawn] = to;
  for (const c of captured) (next.pawns[c.seat] as number[])[c.pawn] = BASE_STEP;
  next.events.push({ type: "move", seat: next.turn, owner: mover, pawn, from, to, captured, auto });
  next.movable = [];

  // Le temps de voir le pion sauter de case en case (et le pion mangé rentrer chez lui).
  const hops = from === BASE_STEP ? 1 : to - from;
  const extra = hops * LUDO_HOP_MS + (captured.length ? LUDO_CAPTURE_MS : 0);

  if (isLudoDone(next, mover) && !next.done.includes(mover)) {
    next.done.push(mover);
    next.events.push({ type: "done", seat: mover });
  }
  const winners = next.options.teams
    ? [mover % 2, (mover % 2) + 2].every((s) => isLudoDone(next, s))
      ? [mover % 2, (mover % 2) + 2]
      : null
    : isLudoDone(next, mover)
      ? [mover]
      : null;
  if (winners) {
    next.winners = winners;
    next.phase = "over";
    next.deadline = null;
    next.events.push({ type: "win", seats: winners });
    return;
  }

  const bonus = die === 6 ? "six" : captured.length ? "capture" : null;
  if (bonus) {
    if (bonus === "capture") next.sixes = 0;
    next.events.push({ type: "bonus", seat: next.turn, reason: bonus });
    next.phase = "roll";
    next.mover = moverFor(next, next.turn);
    next.deadline = deadlineFor(next, next.turn, now, extra);
    return;
  }
  endTurn(next, now, extra);
}

function doRoll(next: LudoState, value: number, now: number, autoMove: boolean, auto: boolean): void {
  const seat = next.turn;
  next.die = value;
  next.events.push({ type: "roll", seat, value, auto });
  if (value === 6) {
    next.sixes += 1;
    if (next.sixes >= 3) {
      next.events.push({ type: "threeSixes", seat });
      endTurn(next, now, LUDO_DIE_MS);
      return;
    }
  }
  const mover = moverFor(next, seat);
  next.mover = mover;
  const movable = movablePawns(next, mover, value);
  if (movable.length === 0) {
    next.events.push({ type: "noMove", seat, value });
    if (value === 6) {
      next.phase = "roll";
      next.deadline = deadlineFor(next, seat, now, LUDO_DIE_MS);
    } else endTurn(next, now, LUDO_DIE_MS);
    return;
  }
  next.phase = "move";
  next.movable = movable;
  // Un seul choix possible (ou des pions tous pareils, comme ceux de la maison) : on joue tout de suite.
  const pawns = next.pawns[mover] as number[];
  const distinct = new Set(movable.map((i) => pawns[i]));
  if (autoMove && distinct.size === 1) {
    doMove(next, movable[0] as number, now, true);
    return;
  }
  next.deadline = deadlineFor(next, seat, now, LUDO_DIE_MS);
}

/**
 * Lance le dé avec un chiffre donné. Le serveur tire ce chiffre lui-même (voir applyLudoAction) ;
 * la partie guidée utilise des chiffres préparés. `autoMove` : jouer seul quand il n'y a qu'un choix.
 */
export function applyLudoRoll(state: LudoState, seat: number, value: number, now: number, autoMove = true): LudoResult {
  if (state.phase === "over") return { ok: false, error: "game_over" };
  if (state.turn !== seat) return { ok: false, error: "not_your_turn" };
  if (state.phase !== "roll") return { ok: false, error: "must_move" };
  if (!Number.isInteger(value) || value < 1 || value > 6) return { ok: false, error: "invalid_die" };
  const next = clone(state);
  doRoll(next, value, now, autoMove, false);
  return { ok: true, state: next };
}

export function applyLudoMove(state: LudoState, seat: number, pawn: number, now: number): LudoResult {
  if (state.phase === "over") return { ok: false, error: "game_over" };
  if (state.turn !== seat) return { ok: false, error: "not_your_turn" };
  if (state.phase !== "move") return { ok: false, error: "must_roll" };
  if (!state.movable.includes(pawn)) return { ok: false, error: "illegal_move" };
  const next = clone(state);
  doMove(next, pawn, now, false);
  return { ok: true, state: next };
}

export function rollDie(rng: LudoRng): number {
  return Math.min(6, 1 + Math.floor(rng() * 6));
}

/** Action d'un joueur. Le dé est tiré ici, par le serveur : le client ne choisit jamais le chiffre. */
export function applyLudoAction(state: LudoState, seat: number, action: LudoAction, rng: LudoRng, now: number): LudoResult {
  if (action.type === "roll") return applyLudoRoll(state, seat, rollDie(rng), now);
  return applyLudoMove(state, seat, action.pawn, now);
}

/**
 * Le chrono est fini (ou c'est à un bot) : le serveur joue à la place du joueur.
 * Un humain absent lance et bouge d'un coup ; un bot lance, puis bouge au tick suivant.
 */
export function applyLudoTimeout(state: LudoState, rng: LudoRng, now: number): LudoResult {
  if (state.phase === "over" || state.deadline === null || now < state.deadline) return { ok: false, error: "not_expired" };
  const seat = state.turn;
  const next = clone(state);
  if (next.phase === "roll") {
    doRoll(next, rollDie(rng), now, true, true);
    if ((next.phase as LudoPhase) === "move" && next.turn === seat && !next.bots.includes(seat)) doMove(next, chooseLudoBotMove(next), now, true);
  } else {
    doMove(next, chooseLudoBotMove(next), now, true);
  }
  return { ok: true, state: next };
}

/** Combien d'adversaires peuvent manger ce pion au prochain lancer (0 s'il est à l'abri). */
export function dangerOf(state: LudoState, seat: number, step: number): number {
  const index = trackIndexOf(state.colors[seat] as LudoColor, step);
  if (index === null || isSafeTrackIndex(index)) return 0;
  let n = 0;
  state.pawns.forEach((pawns, other) => {
    if (areLudoAllies(state, other, seat)) return;
    for (const s of pawns) {
      const i = trackIndexOf(state.colors[other] as LudoColor, s);
      if (i === null) continue;
      const d = (index - i + TRACK_LENGTH) % TRACK_LENGTH;
      if (d >= 1 && d <= 6 && s + d <= LAST_TRACK_STEP) n += 1;
    }
  });
  return n;
}

/**
 * Le bot simple : manger si possible, sinon sortir un pion, sinon sauver le pion le plus en danger,
 * sinon rentrer au centre, se mettre à l'abri, ou avancer le pion le plus avancé.
 */
export function chooseLudoBotMove(state: LudoState): number {
  const mover = state.mover;
  const die = state.die ?? 0;
  const pawns = state.pawns[mover] ?? [];
  let best = state.movable[0] ?? 0;
  let bestScore = -Infinity;
  for (const pawn of state.movable) {
    const from = pawns[pawn] as number;
    const to = targetStep(from, die);
    if (to === null) continue;
    const toIndex = trackIndexOf(state.colors[mover] as LudoColor, to);
    let score: number;
    if (capturesAt(state, mover, to).length) score = 4000 + to;
    else if (from === BASE_STEP) score = 3000;
    else if (dangerOf(state, mover, from) > 0) score = 2000 + dangerOf(state, mover, from) * 100 + from;
    else if (to === FINISH_STEP) score = 1500;
    else if (toIndex !== null && isSafeTrackIndex(toIndex)) score = 1000 + to;
    else score = to - dangerOf({ ...state, pawns: state.pawns.map((p, s) => (s === mover ? p.map((x, i) => (i === pawn ? to : x)) : p)) }, mover, to) * 60;
    if (score > bestScore) {
      bestScore = score;
      best = pawn;
    }
  }
  return best;
}
