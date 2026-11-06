/**
 * Règles de la Ronda (docs/ICOSIUM.md, « Règles de la Ronda »). Fonctions pures : aucun réseau,
 * aucune interface. Le serveur les appelle pour valider chaque carte et c'est lui qui mélange ;
 * la partie guidée du téléphone les appelle avec un paquet préparé.
 *
 * - 2 joueurs, ou 4 en équipes (chaises 0 et 2 contre 1 et 3) ; on joue chacun son tour ;
 * - 4 cartes visibles sur la table au début de chaque manche (toutes différentes, sans suite),
 *   puis 3 cartes à chacun à chaque donne ;
 * - une carte prend la carte de même valeur sur la table, plus les suivantes en suite montante ;
 * - caïda : prendre la carte que l'adversaire vient de poser = 1 point ; à 4, le joueur suivant
 *   peut reprendre le tout avec la 3e carte identique (5 points), puis la 4e (10 points) ;
 * - missa : vider la table = 1 point, sauf avec la toute dernière carte de la manche ;
 * - annonces avant sa première carte de chaque donne : ronda (paire) 1 point, tringa (brelan)
 *   5 points ; la meilleure gagne tout. Le serveur vérifie à la fin de la donne : annonce fausse
 *   (bluff) ou oubliée = les points vont à l'adversaire ;
 * - fin de manche : les cartes de la table vont au dernier qui a pris ; 1 point par carte au-delà
 *   de 20 ; on gagne dès qu'on atteint 41 (ou 25), même en pleine manche.
 */
import { type RondaCard, type RondaRng, rondaDeck, rondaValue, shuffleRonda } from "./cards.ts";
import type { RondaOptions } from "./options.ts";

export type RondaAnnounce = "ronda" | "tringa";
export type RondaPhase = "play" | "over";

/** Points d'une caïda selon le nombre de cartes identiques en jeu : « wahed », « khamsa », « achra ». */
export const CAIDA_POINTS = [1, 5, 10] as const;
export const ANNOUNCE_POINTS: Record<RondaAnnounce, number> = { ronda: 1, tringa: 5 };
export const CARDS_PER_DEAL = 3;
export const TABLE_START = 4;
/** Au-delà de ce nombre de cartes ramassées, chaque carte vaut 1 point. */
export const CARDS_THRESHOLD = 20;

/** Résultat de la vérification d'une annonce (ou d'une annonce oubliée), à la fin de la donne. */
export type RondaAnnounceOutcome = {
  seat: number;
  /** Ce qui a été annoncé (null : rien annoncé). */
  announced: RondaAnnounce | null;
  /** Ce que la main contenait vraiment (null : rien). */
  held: RondaAnnounce | null;
  /** Valeur de la paire ou du brelan (1 à 10), quand il y en avait un. */
  value: number | null;
  /** best : la meilleure annonce ; beaten : battue ; tie : à égalité ; bluff : fausse ; forgot : oubliée. */
  result: "best" | "beaten" | "tie" | "bluff" | "forgot";
};

/** Ce qui vient de se passer, pour les animations, les sons et le mot crié. */
export type RondaEvent =
  | { type: "round"; round: number; dealer: number; table: RondaCard[] }
  | { type: "deal"; dealer: number; deal: number }
  | { type: "announce"; seat: number; kind: RondaAnnounce }
  | {
      type: "play";
      seat: number;
      card: RondaCard;
      /** Cartes prises (sans la carte jouée) ; vide si la carte reste sur la table. */
      captured: RondaCard[];
      /** Cartes reprises à l'adversaire (khamsa, achra). */
      stolen: RondaCard[];
      /** 1, 5 ou 10 pour une caïda, sinon 0. */
      caida: number;
      missa: boolean;
      auto: boolean;
    }
  | { type: "announces"; outcomes: RondaAnnounceOutcome[]; points: [number, number] }
  | { type: "sweep"; team: number; cards: RondaCard[] }
  | { type: "roundEnd"; counts: [number, number]; points: [number, number] }
  | { type: "win"; team: number };

/** Une caïda que le joueur suivant peut encore reprendre (à 4, avec une carte identique). */
export type RondaStreak = { value: number; team: number; level: number; cards: RondaCard[] };

export type RondaState = {
  options: RondaOptions;
  /** Pioche (secrète, jamais envoyée aux joueurs). */
  deck: RondaCard[];
  /** Mains (secrètes : chaque joueur ne reçoit que la sienne). */
  hands: RondaCard[][];
  /** Mains au moment de la donne, pour vérifier les annonces (secret). */
  dealt: RondaCard[][];
  /** Cartes visibles sur la table, dans l'ordre où elles ont été posées. */
  table: RondaCard[];
  /** Cartes ramassées par chaque équipe pendant la manche. */
  piles: [RondaCard[], RondaCard[]];
  scores: [number, number];
  round: number;
  /** Numéro de la donne dans la manche (1, 2…). */
  deal: number;
  dealer: number;
  turn: number;
  /** Dernière carte posée sur la table sans rien prendre (pour la caïda). */
  lastPlay: { seat: number; card: RondaCard } | null;
  streak: RondaStreak | null;
  lastCapturer: number | null;
  /** Annonces de la donne en cours. */
  announced: (RondaAnnounce | null)[];
  /** Qui a déjà posé sa première carte de la donne (après, on ne peut plus annoncer). */
  played: boolean[];
  bots: number[];
  phase: RondaPhase;
  winner: number | null;
  events: RondaEvent[];
  eventSeq: number;
  deadline: number | null;
};

export type RondaAction = { type: "announce"; kind: RondaAnnounce } | { type: "play"; card: RondaCard; announce?: RondaAnnounce };
export type RondaResult = { ok: true; state: RondaState } | { ok: false; error: string };

/** Temps de « réflexion » d'un bot, pour que la partie reste lisible. */
export const RONDA_BOT_DELAY_MS = 1100;
/** Durées des animations, ajoutées au chrono pour que personne ne perde de temps à regarder. */
export const RONDA_PLAY_MS = 450;
export const RONDA_CAPTURE_MS = 550;
export const RONDA_DEAL_MS = 900;
export const RONDA_ROUND_MS = 2600;

export const rondaTeamOf = (state: Pick<RondaState, "options">, seat: number) => (state.options.players === 4 ? seat % 2 : seat);
const playersOf = (state: RondaState) => state.options.players;

function clone(state: RondaState): RondaState {
  return {
    ...state,
    options: { ...state.options },
    deck: [...state.deck],
    hands: state.hands.map((h) => [...h]),
    dealt: state.dealt.map((h) => [...h]),
    table: [...state.table],
    piles: [[...state.piles[0]], [...state.piles[1]]],
    scores: [...state.scores],
    lastPlay: state.lastPlay ? { ...state.lastPlay } : null,
    streak: state.streak ? { ...state.streak, cards: [...state.streak.cards] } : null,
    announced: [...state.announced],
    played: [...state.played],
    bots: [...state.bots],
    events: [],
    eventSeq: state.eventSeq + 1,
  };
}

/** Ce que contient vraiment une main de 3 cartes : brelan, paire ou rien (avec sa valeur). */
export function rondaCombo(hand: readonly RondaCard[]): { kind: RondaAnnounce; value: number } | null {
  const counts = new Map<number, number>();
  for (const c of hand) counts.set(rondaValue(c), (counts.get(rondaValue(c)) ?? 0) + 1);
  let best: { kind: RondaAnnounce; value: number } | null = null;
  for (const [value, n] of counts) {
    if (n >= 3) return { kind: "tringa", value };
    if (n === 2 && (!best || value > best.value)) best = { kind: "ronda", value };
  }
  return best;
}

/**
 * Pose les 4 cartes de départ : toutes différentes et sans deux valeurs qui se suivent. Une carte
 * fautive retourne dans le paquet et on prend la suivante.
 */
export function drawStartTable(deck: RondaCard[]): { table: RondaCard[]; deck: RondaCard[] } {
  const table: RondaCard[] = [];
  const rest: RondaCard[] = [];
  for (const card of deck) {
    const v = rondaValue(card);
    if (table.length < TABLE_START && table.every((t) => Math.abs(rondaValue(t) - v) > 1)) table.push(card);
    else rest.push(card);
  }
  return { table, deck: rest };
}

function deadlineFor(state: RondaState, seat: number, now: number, extraMs: number): number | null {
  if (state.bots.includes(seat)) return now + RONDA_BOT_DELAY_MS + extraMs;
  const secs = state.options.turnSeconds;
  return secs ? now + secs * 1000 + extraMs : null;
}

/** Donne 3 cartes à chacun, en commençant par le joueur après le donneur. */
function dealHands(next: RondaState): void {
  const n = playersOf(next);
  for (let k = 1; k <= n; k++) {
    const seat = (next.dealer + k) % n;
    next.hands[seat] = next.deck.splice(0, CARDS_PER_DEAL);
  }
  next.dealt = next.hands.map((h) => [...h]);
  next.deal += 1;
  next.announced = Array.from({ length: n }, () => null);
  next.played = Array.from({ length: n }, () => false);
  // Pas de caïda sur la dernière carte de la donne d'avant.
  next.lastPlay = null;
  next.streak = null;
  next.events.push({ type: "deal", dealer: next.dealer, deal: next.deal });
}

/** Nouvelle manche : on mélange, on pose 4 cartes sur la table, on donne. */
function startRound(next: RondaState, rng: RondaRng, deck?: readonly RondaCard[]): void {
  const n = playersOf(next);
  const drawn = drawStartTable(deck ? [...deck] : shuffleRonda(rondaDeck(), rng));
  next.deck = drawn.deck;
  next.table = drawn.table;
  next.piles = [[], []];
  next.round += 1;
  next.deal = 0;
  next.lastCapturer = null;
  next.hands = Array.from({ length: n }, () => []);
  next.events.push({ type: "round", round: next.round, dealer: next.dealer, table: [...next.table] });
  dealHands(next);
  next.turn = (next.dealer + 1) % n;
}

/**
 * Nouvelle partie. `deck` : paquet préparé (partie guidée, tests) ; sinon le serveur mélange.
 * `dealer` : la chaise qui donne la première manche (au hasard par défaut).
 */
export function createRondaGame(
  options: RondaOptions,
  rng: RondaRng,
  now: number,
  bots: readonly number[] = [],
  setup: { deck?: readonly RondaCard[]; dealer?: number } = {},
): RondaState {
  const n = options.players;
  const dealer = setup.dealer ?? Math.min(n - 1, Math.floor(rng() * n));
  const state: RondaState = {
    options: { ...options },
    deck: [],
    hands: Array.from({ length: n }, () => []),
    dealt: Array.from({ length: n }, () => []),
    table: [],
    piles: [[], []],
    scores: [0, 0],
    round: 0,
    deal: 0,
    dealer,
    turn: (dealer + 1) % n,
    lastPlay: null,
    streak: null,
    lastCapturer: null,
    announced: Array.from({ length: n }, () => null),
    played: Array.from({ length: n }, () => false),
    bots: [...bots],
    phase: "play",
    winner: null,
    events: [],
    eventSeq: 0,
    deadline: null,
  };
  startRound(state, rng, setup.deck);
  state.deadline = deadlineFor(state, state.turn, now, RONDA_DEAL_MS);
  return state;
}

/** Ajoute des points ; renvoie true si la partie est gagnée (41 ou 25 atteint). */
function addPoints(next: RondaState, team: number, points: number): boolean {
  if (points <= 0 || next.phase === "over") return next.phase === "over";
  next.scores[team as 0 | 1] += points;
  if (next.scores[team as 0 | 1] >= next.options.target) {
    next.phase = "over";
    next.winner = team;
    next.deadline = null;
    next.events.push({ type: "win", team });
    return true;
  }
  return false;
}

/** Les cartes qu'une carte de valeur `value` prend sur la table : la même valeur, puis la suite. */
export function captureFor(table: readonly RondaCard[], value: number): RondaCard[] {
  const byValue = new Map(table.map((c) => [rondaValue(c), c]));
  const first = byValue.get(value);
  if (!first) return [];
  const out = [first];
  for (let v = value + 1; byValue.has(v); v++) out.push(byValue.get(v) as RondaCard);
  return out;
}

/** Ce que rapporterait une carte, sans rien changer (pour le bot et l'aide à l'écran). */
export function previewRondaPlay(state: RondaState, seat: number, card: RondaCard) {
  const value = rondaValue(card);
  const team = rondaTeamOf(state, seat);
  const streak = state.streak;
  const steal = Boolean(streak && streak.value === value && streak.team !== team && streak.level < CAIDA_POINTS.length);
  const captured = captureFor(state.table, value);
  const caidaOnTable = Boolean(state.lastPlay && rondaValue(state.lastPlay.card) === value && rondaTeamOf(state, state.lastPlay.seat) !== team && captured[0] === state.lastPlay.card);
  const caida = steal ? CAIDA_POINTS[(streak as RondaStreak).level] : caidaOnTable ? CAIDA_POINTS[0] : 0;
  const takes = captured.length + (steal ? (streak as RondaStreak).cards.length : 0);
  const lastCardOfRound = state.deck.length === 0 && state.hands.every((h, s) => (s === seat ? h.length === 1 : h.length === 0));
  const missa = takes > 0 && state.table.length - captured.length === 0 && !lastCardOfRound;
  return { captured, stolen: steal ? [...(streak as RondaStreak).cards] : [], caida: caida as number, missa, takes };
}

/** Vérifie les annonces de la donne qui vient de finir et donne les points. */
function settleAnnounces(next: RondaState): void {
  const n = playersOf(next);
  const outcomes: RondaAnnounceOutcome[] = [];
  const points: [number, number] = [0, 0];
  const valid: { seat: number; kind: RondaAnnounce; value: number }[] = [];
  for (let seat = 0; seat < n; seat++) {
    const held = rondaCombo(next.dealt[seat] ?? []);
    const announced = next.announced[seat] ?? null;
    const other = 1 - rondaTeamOf(next, seat);
    if (!announced && held) {
      points[other as 0 | 1] += ANNOUNCE_POINTS[held.kind];
      outcomes.push({ seat, announced: null, held: held.kind, value: held.value, result: "forgot" });
    } else if (announced && (!held || (announced === "tringa" && held.kind !== "tringa"))) {
      points[other as 0 | 1] += ANNOUNCE_POINTS[announced];
      outcomes.push({ seat, announced, held: held?.kind ?? null, value: null, result: "bluff" });
    } else if (announced && held) {
      // Annoncer « ronda » avec un brelan en main compte comme une ronda.
      valid.push({ seat, kind: announced, value: held.value });
    }
  }
  if (valid.length) {
    const rank = (v: { kind: RondaAnnounce; value: number }) => (v.kind === "tringa" ? 100 : 0) + v.value;
    const top = Math.max(...valid.map(rank));
    const total = valid.reduce((sum, v) => sum + ANNOUNCE_POINTS[v.kind], 0);
    const bestTeams = new Set(valid.filter((v) => rank(v) === top).map((v) => rondaTeamOf(next, v.seat)));
    if (bestTeams.size > 1) {
      // Égalité entre adversaires : on partage (demi-points arrondis vers le bas).
      points[0] += Math.floor(total / 2);
      points[1] += Math.floor(total / 2);
    } else points[[...bestTeams][0] as 0 | 1] += total;
    for (const v of valid) {
      const best = rank(v) === top;
      outcomes.push({ seat: v.seat, announced: v.kind, held: v.kind, value: v.value, result: best ? (bestTeams.size > 1 ? "tie" : "best") : "beaten" });
    }
  }
  if (!outcomes.length) return;
  outcomes.sort((a, b) => a.seat - b.seat);
  next.events.push({ type: "announces", outcomes, points });
  for (const team of [0, 1] as const) if (addPoints(next, team, points[team])) return;
}

/** Fin de manche : la table au dernier qui a pris, puis les cartes au-delà de 20. */
function endRound(next: RondaState, rng: RondaRng, now: number): void {
  if (next.table.length && next.lastCapturer !== null) {
    const team = rondaTeamOf(next, next.lastCapturer);
    next.events.push({ type: "sweep", team, cards: [...next.table] });
    next.piles[team as 0 | 1].push(...next.table);
    next.table = [];
  }
  const counts: [number, number] = [next.piles[0].length, next.piles[1].length];
  const points: [number, number] = [Math.max(0, counts[0] - CARDS_THRESHOLD), Math.max(0, counts[1] - CARDS_THRESHOLD)];
  next.events.push({ type: "roundEnd", counts, points });
  for (const team of [0, 1] as const) if (addPoints(next, team, points[team])) return;
  next.dealer = (next.dealer + 1) % playersOf(next);
  startRound(next, rng);
  next.deadline = deadlineFor(next, next.turn, now, RONDA_ROUND_MS + RONDA_DEAL_MS);
}

function doAnnounce(next: RondaState, seat: number, kind: RondaAnnounce): void {
  next.announced[seat] = kind;
  next.events.push({ type: "announce", seat, kind });
}

function doPlay(next: RondaState, seat: number, card: RondaCard, rng: RondaRng, now: number, auto: boolean): void {
  const team = rondaTeamOf(next, seat);
  const p = previewRondaPlay(next, seat, card);
  const hand = next.hands[seat] as RondaCard[];
  hand.splice(hand.indexOf(card), 1);
  next.played[seat] = true;

  next.events.push({ type: "play", seat, card, captured: p.captured, stolen: p.stolen, caida: p.caida, missa: p.missa, auto });
  const extra = RONDA_PLAY_MS + (p.takes ? RONDA_CAPTURE_MS : 0);
  if (p.takes) {
    const taken = new Set(p.captured);
    next.table = next.table.filter((c) => !taken.has(c));
    if (p.stolen.length) {
      const from = next.piles[(1 - team) as 0 | 1];
      next.piles[(1 - team) as 0 | 1] = from.filter((c) => !p.stolen.includes(c));
    }
    const won = [card, ...p.captured, ...p.stolen];
    next.piles[team as 0 | 1].push(...won);
    next.lastCapturer = seat;
    next.lastPlay = null;
    // À 4, une caïda peut encore être reprise par le joueur suivant.
    next.streak =
      p.caida && playersOf(next) === 4
        ? { value: rondaValue(card), team, level: (CAIDA_POINTS as readonly number[]).indexOf(p.caida) + 1, cards: won }
        : null;
    if (addPoints(next, team, p.caida + (p.missa ? 1 : 0))) return;
  } else {
    next.table.push(card);
    next.lastPlay = { seat, card };
    next.streak = null;
  }

  const n = playersOf(next);
  next.turn = (seat + 1) % n;
  if (next.hands.every((h) => h.length === 0)) {
    settleAnnounces(next);
    if (next.phase === "over") return;
    if (next.deck.length === 0) {
      endRound(next, rng, now);
      return;
    }
    dealHands(next);
    next.deadline = deadlineFor(next, next.turn, now, extra + RONDA_DEAL_MS);
    return;
  }
  next.deadline = deadlineFor(next, next.turn, now, extra);
}

function checkAnnounce(state: RondaState, seat: number): string | null {
  if (state.phase === "over") return "game_over";
  if (seat < 0 || seat >= playersOf(state)) return "not_seated";
  if (state.played[seat]) return "too_late";
  if (state.announced[seat]) return "already_announced";
  return null;
}

/**
 * Action d'un joueur. Annoncer : avant sa première carte de la donne, même quand ce n'est pas son
 * tour. Jouer : seulement à son tour, une carte de sa main (avec une annonce en même temps si on veut).
 * `rng` sert à mélanger la manche suivante (le serveur mélange, jamais le téléphone).
 */
export function applyRondaAction(state: RondaState, seat: number, action: RondaAction, rng: RondaRng, now: number): RondaResult {
  if (action.type === "announce") {
    if (action.kind !== "ronda" && action.kind !== "tringa") return { ok: false, error: "invalid_announce" };
    const err = checkAnnounce(state, seat);
    if (err) return { ok: false, error: err };
    const next = clone(state);
    doAnnounce(next, seat, action.kind);
    return { ok: true, state: next };
  }
  if (state.phase === "over") return { ok: false, error: "game_over" };
  if (state.turn !== seat) return { ok: false, error: "not_your_turn" };
  if (!(state.hands[seat] ?? []).includes(action.card)) return { ok: false, error: "not_in_hand" };
  const next = clone(state);
  if (action.announce) {
    if (action.announce !== "ronda" && action.announce !== "tringa") return { ok: false, error: "invalid_announce" };
    const err = checkAnnounce(state, seat);
    if (err) return { ok: false, error: err };
    doAnnounce(next, seat, action.announce);
  }
  doPlay(next, seat, action.card, rng, now, false);
  return { ok: true, state: next };
}

/**
 * Le chrono est fini (ou c'est à un bot) : le serveur joue à la place du joueur. Il annonce pour
 * lui ce qu'il a vraiment en main (une coupure de réseau ne doit pas coûter de points).
 */
export function applyRondaTimeout(state: RondaState, rng: RondaRng, now: number): RondaResult {
  if (state.phase === "over" || state.deadline === null || now < state.deadline) return { ok: false, error: "not_expired" };
  const seat = state.turn;
  const next = clone(state);
  const combo = rondaCombo(next.hands[seat] ?? []);
  if (!next.played[seat] && !next.announced[seat] && combo) doAnnounce(next, seat, combo.kind);
  doPlay(next, seat, chooseRondaBotCard(next, seat), rng, now, true);
  return { ok: true, state: next };
}

/**
 * Le bot simple : il prend le plus de cartes possible (en visant d'abord les points), sinon il
 * pose sa plus petite carte, en évitant si possible d'offrir une caïda.
 */
export function chooseRondaBotCard(state: RondaState, seat: number): RondaCard {
  const hand = state.hands[seat] ?? [];
  let best = hand[0] as RondaCard;
  let bestScore = -Infinity;
  for (const card of hand) {
    const p = previewRondaPlay(state, seat, card);
    let score: number;
    if (p.takes) score = 1000 + (p.caida + (p.missa ? 1 : 0)) * 100 + p.takes * 10;
    else {
      // Une carte dont on garde le double en main rend une caïda moins probable pour l'adversaire.
      const twin = hand.filter((c) => rondaValue(c) === rondaValue(card)).length > 1;
      score = -rondaValue(card) + (twin ? 5 : 0);
    }
    if (score > bestScore) {
      bestScore = score;
      best = card;
    }
  }
  return best;
}
