import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOMINO_OPTIONS,
  BOT_DELAY_MS,
  DECLARE_MS,
  ROUND_BREAK_MS,
  type DominoOptions,
  type DominoState,
  type PlacedTile,
  type TileId,
  applyDominoAction,
  applyTimeout,
  chooseBotMove,
  chooseFamilyDeal,
  doublesIn,
  familyOf,
  createDominoGame,
  fullSet,
  handOf,
  legalMoves,
  parseDominoOptions,
  publicView,
  seededRng,
  startNextRound,
  tileValue,
} from "../src/domino/index.ts";

const NOW = 1_000_000;
const opts = (o: Partial<DominoOptions> = {}): DominoOptions => ({ ...DEFAULT_DOMINO_OPTIONS, ...o });

/** Construit une manche sur mesure pour tester un cas précis. */
function state(partial: Partial<DominoState> & { hands: TileId[][] }): DominoState {
  return {
    options: opts({ players: partial.hands.length === 2 ? 2 : 4 }),
    phase: "playing",
    round: 2,
    boneyard: [],
    chain: [],
    turn: 0,
    passesInRow: 0,
    mustOpenWith: null,
    scores: [0, 0],
    roundOpener: 0,
    nextOpener: null,
    openers: [],
    chainStart: 0,
    lastResult: null,
    winnerTeam: null,
    events: [],
    eventSeq: 0,
    deadline: NOW + 30_000,
    ...partial,
  };
}

const placed = (tile: TileId, left: number, right: number, seat = 0): PlacedTile => ({ tile, left, right, seat });

describe("le matériel", () => {
  it("compte 28 dominos dont 7 doubles", () => {
    const set = fullSet();
    expect(set).toHaveLength(28);
    expect(new Set(set).size).toBe(28);
    expect(set.filter((t) => t[0] === t[2])).toHaveLength(7);
  });
  it("donne à un domino la somme de ses deux côtés", () => {
    expect(tileValue("4-6")).toBe(10);
    expect(tileValue("0-0")).toBe(0);
  });
});

describe("la distribution", () => {
  it("à 4 : 7 dominos chacun, pas de pioche, le double-six ouvre", () => {
    const g = createDominoGame(opts(), seededRng(1), NOW);
    expect(g.hands.map((h) => h.length)).toEqual([7, 7, 7, 7]);
    expect(g.boneyard).toHaveLength(0);
    expect(new Set(g.hands.flat()).size).toBe(28);
    expect(g.mustOpenWith).toBe("6-6");
    expect(g.hands[g.turn]).toContain("6-6");
    expect(legalMoves(g, g.turn)).toEqual([{ tile: "6-6", end: "right" }]);
  });
  it("à 2 : 7 dominos chacun et 14 dans la pioche", () => {
    const g = createDominoGame(opts({ players: 2 }), seededRng(2), NOW);
    expect(g.hands.map((h) => h.length)).toEqual([7, 7]);
    expect(g.boneyard).toHaveLength(14);
  });
  it("à 2, sans double-six en main, le plus gros double ouvre", () => {
    for (let seed = 1; seed < 60; seed++) {
      const g = createDominoGame(opts({ players: 2 }), seededRng(seed), NOW);
      if (g.hands.flat().includes("6-6")) continue;
      const doubles = g.hands.flat().filter((t) => t[0] === t[2]).sort().reverse();
      if (doubles.length === 0) continue;
      expect(g.mustOpenWith).toBe(doubles[0]);
      return;
    }
    throw new Error("aucune donne de test trouvée");
  });
});

describe("les coups", () => {
  it("refuse de jouer hors de son tour", () => {
    const s = state({ hands: [["1-2"], ["2-3"], ["3-4"], ["4-5"]], chain: [placed("2-2", 2, 2)] });
    expect(applyDominoAction(s, 1, { type: "play", tile: "2-3", end: "left" }, NOW)).toEqual({ ok: false, error: "not_your_turn" });
  });
  it("refuse un domino qu'on n'a pas", () => {
    const s = state({ hands: [["1-2"], [], [], []], chain: [placed("2-2", 2, 2)] });
    expect(applyDominoAction(s, 0, { type: "play", tile: "2-5", end: "left" }, NOW)).toEqual({ ok: false, error: "tile_not_in_hand" });
  });
  it("refuse un domino qui ne va à aucun bout", () => {
    const s = state({ hands: [["5-6", "1-2"], ["0-0"], ["0-1"], ["0-2"]], chain: [placed("3-4", 3, 4)] });
    expect(applyDominoAction(s, 0, { type: "play", tile: "5-6", end: "right" }, NOW)).toEqual({ ok: false, error: "illegal_move" });
  });
  it("refuse d'ouvrir la première manche sans le double-six", () => {
    const s = state({ hands: [["6-6", "1-2"], ["0-0"], ["0-1"], ["0-2"]], mustOpenWith: "6-6" });
    expect(applyDominoAction(s, 0, { type: "play", tile: "1-2", end: "right" }, NOW)).toEqual({ ok: false, error: "illegal_move" });
  });
  it("pose aux deux bouts en orientant le domino", () => {
    let s = state({
      hands: [["3-5", "1-1"], ["4-6", "0-0"], ["0-1"], ["0-2"]],
      chain: [placed("3-4", 3, 4)],
    });
    const r1 = applyDominoAction(s, 0, { type: "play", tile: "3-5", end: "left" }, NOW);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    s = r1.state;
    expect(s.chain[0]).toMatchObject({ tile: "3-5", left: 5, right: 3 });
    expect(s.turn).toBe(1);
    const r2 = applyDominoAction(s, 1, { type: "play", tile: "4-6", end: "right" }, NOW);
    expect(r2.ok && r2.state.chain.at(-1)).toMatchObject({ tile: "4-6", left: 4, right: 6 });
  });
  it("le gagnant de la manche précédente ouvre avec le domino de son choix", () => {
    const s = state({ hands: [["1-2", "3-5"], ["0-0"], ["0-1"], ["0-2"]] });
    expect(legalMoves(s, 0).map((m) => m.tile)).toEqual(["1-2", "3-5"]);
  });
});

describe("passer et piocher", () => {
  it("à 4, le joueur sans domino jouable passe automatiquement", () => {
    const s = state({ hands: [["2-3", "6-6"], ["5-5", "5-6"], ["3-4", "0-0"], ["0-1"]], chain: [placed("2-2", 2, 2)] });
    const r = applyDominoAction(s, 0, { type: "play", tile: "2-3", end: "right" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.turn).toBe(2);
    expect(r.state.events).toContainEqual({ type: "pass", seat: 1 });
  });
  it("à 2, on pioche jusqu'à pouvoir jouer", () => {
    const s = state({
      hands: [["2-3", "6-6"], ["5-5"]],
      chain: [placed("2-2", 2, 2)],
      boneyard: ["0-0", "0-1", "1-3", "4-4"],
    });
    const r = applyDominoAction(s, 0, { type: "play", tile: "2-3", end: "right" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.turn).toBe(1);
    expect(r.state.hands[1]).toEqual(["5-5", "0-0", "0-1", "1-3"]);
    expect(r.state.boneyard).toEqual(["4-4"]);
    expect(r.state.events).toContainEqual({ type: "draw", seat: 1, count: 3 });
  });
  it("à 2, pioche vide et rien à jouer : on passe", () => {
    const s = state({ hands: [["2-3", "3-3"], ["5-5", "5-6"]], chain: [placed("2-2", 2, 2)], boneyard: ["0-0"] });
    const r = applyDominoAction(s, 0, { type: "play", tile: "2-3", end: "right" }, NOW);
    expect(r.ok && r.state.events).toEqual([
      { type: "play", seat: 0, tile: "2-3", end: "right", auto: false, closing: false },
      { type: "draw", seat: 1, count: 1 },
      { type: "pass", seat: 1 },
    ]);
    expect(r.ok && r.state.turn).toBe(0);
  });
});

describe("fin de manche et score", () => {
  it("l'équipe qui ferme marque les points des mains adverses", () => {
    // Équipes : sièges 0 et 2 contre 1 et 3.
    const s = state({ hands: [["2-3"], ["6-6"], ["1-1"], ["4-5"]], chain: [placed("2-2", 2, 2)] });
    const r = applyDominoAction(s, 0, { type: "play", tile: "2-3", end: "right" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.phase).toBe("roundOver");
    expect(r.state.lastResult).toMatchObject({ reason: "closed", winnerTeam: 0, points: 12 + 9, closedBy: 0 });
    expect(r.state.scores).toEqual([21, 0]);
    expect(r.state.events[0]).toMatchObject({ type: "play", closing: true });
    expect(r.state.nextOpener).toBe(0);
    expect(r.state.deadline).toBe(NOW + ROUND_BREAK_MS);
  });
  it("réglage « toutes les mains » : le partenaire compte aussi", () => {
    const s = state({ hands: [["2-3"], ["6-6"], ["1-1"], ["4-5"]], chain: [placed("2-2", 2, 2)] });
    s.options = opts({ scoring: "all" });
    const r = applyDominoAction(s, 0, { type: "play", tile: "2-3", end: "right" }, NOW);
    expect(r.ok && r.state.lastResult?.points).toBe(12 + 2 + 9);
  });
  it("partie bloquée : l'équipe la plus légère gagne les points de l'autre", () => {
    const s = state({
      hands: [["0-4", "1-1"], ["5-5"], ["0-0"], ["6-6"]],
      chain: [placed("0-3", 0, 3)],
    });
    const r = applyDominoAction(s, 0, { type: "play", tile: "0-4", end: "left" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.lastResult).toMatchObject({ reason: "blocked", teamValues: [2, 22], winnerTeam: 0, points: 22 });
    expect(r.state.scores).toEqual([22, 0]);
    // Le joueur le plus léger de l'équipe gagnante ouvrira.
    expect(r.state.nextOpener).toBe(2);
  });
  it("partie bloquée à égalité : manche nulle", () => {
    const s = state({ hands: [["0-4", "1-2"], ["1-1"], ["0-0"], ["0-1"]], chain: [placed("0-3", 0, 3)] });
    // Mains restantes : équipe 0 = 3 + 0, équipe 1 = 2 + 1.
    const r = applyDominoAction(s, 0, { type: "play", tile: "0-4", end: "left" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 0-1 du siège 3 ne va ni sur 4 ni sur 3 ; 0-0 non plus : tout le monde passe.
    expect(r.state.lastResult).toMatchObject({ reason: "blocked", winnerTeam: null, points: 0 });
    expect(r.state.scores).toEqual([0, 0]);
  });
  it("la partie se termine au score cible", () => {
    const s = state({ hands: [["2-3"], ["6-6"], ["1-1"], ["4-5"]], chain: [placed("2-2", 2, 2)], scores: [90, 50] });
    const r = applyDominoAction(s, 0, { type: "play", tile: "2-3", end: "right" }, NOW);
    expect(r.ok && r.state.phase).toBe("gameOver");
    expect(r.ok && r.state.winnerTeam).toBe(0);
    expect(r.ok && r.state.deadline).toBeNull();
  });
  it("la manche suivante est ouverte par le gagnant, sans double imposé", () => {
    const s = state({ hands: [["2-3"], ["6-6"], ["1-1"], ["4-5"]], chain: [placed("2-2", 2, 2)] });
    s.turn = 0;
    const r = applyDominoAction(s, 0, { type: "play", tile: "2-3", end: "right" }, NOW);
    if (!r.ok) throw new Error("coup refusé");
    const next = startNextRound(r.state, seededRng(5), NOW);
    expect(next.ok && next.state.turn).toBe(0);
    expect(next.ok && next.state.mustOpenWith).toBeNull();
    expect(next.ok && next.state.round).toBe(3);
  });
  it("réglage « double-six à chaque fois » : le double-six rouvre", () => {
    const s = state({ hands: [["2-3"], ["6-6"], ["1-1"], ["4-5"]], chain: [placed("2-2", 2, 2)] });
    s.options = opts({ opener: "doubleSix" });
    const r = applyDominoAction(s, 0, { type: "play", tile: "2-3", end: "right" }, NOW);
    if (!r.ok) throw new Error("coup refusé");
    const next = startNextRound(r.state, seededRng(5), NOW);
    expect(next.ok && next.state.mustOpenWith).toBe("6-6");
  });
});

describe("le temps par tour", () => {
  it("ne fait rien avant l'heure limite", () => {
    const g = createDominoGame(opts(), seededRng(3), NOW);
    expect(applyTimeout(g, seededRng(3), NOW + 1000)).toEqual({ ok: false, error: "not_due" });
  });
  it("temps écoulé : le serveur pose le premier domino possible", () => {
    const g = createDominoGame(opts(), seededRng(3), NOW);
    const r = applyTimeout(g, seededRng(3), NOW + 30_000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.chain).toHaveLength(1);
    expect(r.state.chain[0]?.tile).toBe("6-6");
    expect(r.state.events[0]).toMatchObject({ type: "play", auto: true });
  });
  it("illimité entre amis : pas d'heure limite", () => {
    const g = createDominoGame(opts({ turnSeconds: 0 }), seededRng(3), NOW);
    expect(g.deadline).toBeNull();
  });
  it("après la pause de fin de manche, la manche suivante démarre seule", () => {
    const s = state({ hands: [["2-3"], ["6-6"], ["1-1"], ["4-5"]], chain: [placed("2-2", 2, 2)] });
    const r = applyDominoAction(s, 0, { type: "play", tile: "2-3", end: "right" }, NOW);
    if (!r.ok) throw new Error("coup refusé");
    const next = applyTimeout(r.state, seededRng(9), NOW + ROUND_BREAK_MS);
    expect(next.ok && next.state.phase).toBe("playing");
  });
});

describe("une partie complète", () => {
  for (const players of [2, 4] as const) {
    it(`se joue jusqu'au score cible à ${players} joueurs`, () => {
      const rng = seededRng(players * 7);
      let s = createDominoGame(opts({ players, targetScore: 50 }), rng, NOW);
      let now = NOW;
      for (let i = 0; i < 2000 && s.phase !== "gameOver"; i++) {
        now += 31_000;
        const r = applyTimeout(s, rng, now);
        if (!r.ok) throw new Error(r.error);
        s = r.state;
        // Les 28 dominos sont toujours tous là : mains + pioche + chaîne.
        if (s.phase === "playing") {
          const all = [...s.hands.flat(), ...s.boneyard, ...s.chain.map((c) => c.tile)];
          expect(new Set(all).size).toBe(28);
        }
      }
      expect(s.phase).toBe("gameOver");
      expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(50);
    });
  }
});

describe("les informations secrètes", () => {
  it("la vue publique ne contient ni les mains ni la pioche", () => {
    const g = createDominoGame(opts({ players: 2 }), seededRng(4), NOW);
    const view = publicView(g);
    const json = JSON.stringify(view);
    // Seul le domino d'ouverture imposé est public ; aucun autre domino caché n'apparaît.
    for (const tile of [...g.hands.flat(), ...g.boneyard].filter((t) => t !== g.mustOpenWith)) {
      expect(json).not.toContain(`"${tile}"`);
    }
    expect(view.handCounts).toEqual([7, 7]);
    expect(view.boneyardCount).toBe(14);
    expect(handOf(g, 0)).toEqual(g.hands[0]);
  });
});

describe("les réglages", () => {
  it("garde seulement les valeurs autorisées", () => {
    expect(parseDominoOptions({ players: 3, targetScore: 100, turnSeconds: 15, botAllowed: "yes" })).toEqual({
      ...DEFAULT_DOMINO_OPTIONS,
      turnSeconds: 15,
    });
  });
});

describe("l'équipe gagnante se concerte pour ouvrir", () => {
  function wonByZero(scoreBefore = 40) {
    const s = state({ hands: [["2-3"], ["6-6"], ["1-1"], ["4-5"]], chain: [placed("2-2", 2, 2)] });
    s.scores = [scoreBefore, 0];
    const r = applyDominoAction(s, 0, { type: "play", tile: "2-3", end: "right" }, NOW);
    if (!r.ok) throw new Error("setup");
    const next = startNextRound(r.state, seededRng(9), NOW);
    if (!next.ok) throw new Error("setup");
    return next.state;
  }
  it("avant 50 points, seul le gagnant ouvre", () => {
    const g = wonByZero(10); // 10 + 21 = 31 points
    expect(g.openers).toEqual([0]);
  });
  it("au-delà de 50 points, le gagnant et son partenaire peuvent ouvrir, pas les adversaires", () => {
    const g = wonByZero();
    expect(g.openers).toEqual([0, 2]);
    expect(g.mustOpenWith).toBeNull();
    const tile = (g.hands[1] as TileId[])[0] as TileId;
    expect(applyDominoAction(g, 1, { type: "play", tile, end: "right" }, NOW)).toMatchObject({ ok: false, error: "not_your_turn" });
  });
  it("si le partenaire ouvre, le jeu continue après lui", () => {
    const g = wonByZero();
    const tile = (g.hands[2] as TileId[])[0] as TileId;
    const r = applyDominoAction(g, 2, { type: "play", tile, end: "right" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.roundOpener).toBe(2);
    expect(r.state.openers).toEqual([]);
    expect(r.state.turn).not.toBe(2);
    // Une fois la manche ouverte, l'autre membre de l'équipe ne peut plus jouer hors de son tour.
    const other = (r.state.hands[0] as TileId[])[0] as TileId;
    if (r.state.turn !== 0) expect(applyDominoAction(r.state, 0, { type: "play", tile: other, end: "right" }, NOW).ok).toBe(false);
  });
});

/** Un hasard truqué : le premier mélange donne exactement `deck`, les suivants sont aléatoires. */
function riggedRng(deck: TileId[], seed = 7) {
  const after = seededRng(seed);
  const values: number[] = [];
  const out = fullSet();
  for (let i = out.length - 1; i > 0; i--) {
    const j = out.indexOf(deck[i] as TileId);
    values.push((j + 0.5) / (i + 1));
    [out[i], out[j]] = [out[j] as TileId, out[i] as TileId];
  }
  return () => values.shift() ?? after();
}

/** Un paquet dont la main du siège 0 (les 7 premiers dominos) est imposée. */
function deckWithFirstHand(hand: TileId[]): TileId[] {
  return [...hand, ...fullSet().filter((t) => !hand.includes(t))];
}

describe("donne avec 6 doubles", () => {
  it("compte les doubles d'une main", () => {
    expect(doublesIn(["0-0", "1-1", "2-2", "3-3", "5-5", "6-6", "1-6"])).toBe(6);
  });
  it("une main avec 6 doubles annule la donne : on redistribue avant la manche", () => {
    const rng = riggedRng(deckWithFirstHand(["3-3", "1-1", "2-2", "6-6", "5-5", "1-6", "0-0"]));
    const g = createDominoGame(opts(), rng, NOW);
    expect(g.events[0]).toMatchObject({ type: "redeal", reason: "sixDoubles", seat: 0 });
    expect(g.hands.every((h) => doublesIn(h) < 6)).toBe(true);
    expect(g.hands.flat()).toHaveLength(28);
  });
});

describe("donne avec 6 pierres d'une même famille", () => {
  const familyHand: TileId[] = ["3-4", "0-3", "1-3", "2-3", "3-3", "3-5", "1-1"];
  const dealt = () => createDominoGame(opts(), riggedRng(deckWithFirstHand(familyHand)), NOW);

  it("reconnaît la famille", () => {
    expect(familyOf(familyHand)).toBe(3);
    expect(familyOf(["0-1", "0-2", "0-3", "1-1", "2-2", "4-5", "5-6"])).toBeNull();
  });
  it("la manche attend le choix du joueur concerné", () => {
    const g = dealt();
    expect(g.phase).toBe("declare");
    expect(g.declare).toEqual({ seat: 0, family: 3 });
    expect(g.deadline).toBe(NOW + DECLARE_MS);
    expect(publicView(g).declare).toEqual({ seat: 0, family: 3 });
    // Personne ne joue tant que le choix n'est pas fait, et seul ce joueur choisit.
    expect(applyDominoAction(g, 0, { type: "play", tile: "3-3", end: "right" }, NOW).ok).toBe(false);
    expect(chooseFamilyDeal(g, 1, "keep", seededRng(1), NOW)).toMatchObject({ ok: false, error: "not_your_choice" });
  });
  it("« Redéclarer » : on mélange et on redistribue, même manche", () => {
    const g = dealt();
    const r = chooseFamilyDeal(g, 0, "redeclare", seededRng(4), NOW);
    if (!r.ok) throw new Error("refusé");
    expect(r.state.events[0]).toMatchObject({ type: "redeal", reason: "family", seat: 0 });
    expect(r.state.round).toBe(1);
    expect(r.state.hands[0]).not.toEqual(g.hands[0]);
  });
  it("sans choix avant la fin du temps, on redistribue", () => {
    const r = applyTimeout(dealt(), seededRng(4), NOW + DECLARE_MS);
    expect(r.ok && r.state.events[0]).toMatchObject({ type: "redeal", reason: "family" });
  });
  it("« Garder » : on joue, mais l'équipe du joueur ne marquera rien", () => {
    const r = chooseFamilyDeal(dealt(), 0, "keep", seededRng(4), NOW);
    if (!r.ok) throw new Error("refusé");
    expect(r.state.phase).toBe("playing");
    expect(r.state.penaltyTeam).toBe(0);
    expect(r.state.events).toContainEqual({ type: "keep", seat: 0, family: 3 });
  });
  it("si l'équipe qui a gardé gagne la manche, les points vont aux adversaires", () => {
    const s = state({ hands: [["2-3"], ["6-6"], ["1-1"], ["4-5"]], chain: [placed("2-2", 2, 2)], penaltyTeam: 0 });
    const r = applyDominoAction(s, 0, { type: "play", tile: "2-3", end: "right" }, NOW);
    if (!r.ok) throw new Error("refusé");
    expect(r.state.scores).toEqual([0, 21]);
    expect(r.state.lastResult).toMatchObject({ winnerTeam: 1, points: 21, penalized: true });
  });
  it("si les adversaires gagnent, ils marquent normalement", () => {
    const s = state({ hands: [["6-6"], ["2-3"], ["1-1"], ["4-5"]], chain: [placed("2-2", 2, 2)], penaltyTeam: 0, turn: 1 });
    const r = applyDominoAction(s, 1, { type: "play", tile: "2-3", end: "right" }, NOW);
    if (!r.ok) throw new Error("refusé");
    expect(r.state.scores).toEqual([0, 14]);
    expect(r.state.lastResult?.penalized).toBeUndefined();
  });
});

describe("blocage à égalité", () => {
  it("aucun point, la manche est rejouée et le double-six ouvre", () => {
    const s = state({ hands: [["0-4", "1-2"], ["1-1"], ["0-0"], ["0-1"]], chain: [placed("0-3", 0, 3)], round: 4, scores: [60, 30] });
    s.lastResult = { round: 3, reason: "closed", winnerTeam: 0, points: 20, closedBy: 2, handValues: [], teamValues: [0, 20], hands: [] };
    const r = applyDominoAction(s, 0, { type: "play", tile: "0-4", end: "left" }, NOW);
    if (!r.ok) throw new Error("refusé");
    expect(r.state.scores).toEqual([60, 30]);
    expect(r.state.nextOpener).toBeNull();
    const next = startNextRound(r.state, seededRng(2), NOW);
    if (!next.ok) throw new Error("refusé");
    expect(next.state.round).toBe(4);
    expect(next.state.mustOpenWith).toBe("6-6");
    expect(next.state.hands[next.state.turn]).toContain("6-6");
    expect(next.state.openers).toEqual([next.state.turn]);
  });
});

describe("les bots", () => {
  it("un bot joue vite, à la place du chrono", () => {
    let g = createDominoGame(opts(), seededRng(11), NOW, [1, 2, 3]);
    if (g.phase === "declare") g = (applyTimeout(g, seededRng(1), NOW + DECLARE_MS) as { state: DominoState }).state;
    const humanFirst = g.turn === 0;
    expect(g.deadline).toBe(humanFirst ? NOW + 30_000 : NOW + BOT_DELAY_MS);
  });
  it("un bot ferme dès qu'il peut", () => {
    const s = state({ hands: [["1-1", "4-4"], ["2-3"], ["5-5"], ["6-6"]], chain: [placed("2-2", 2, 2)], turn: 1, bots: [1] });
    expect(chooseBotMove(s, 1)?.tile).toBe("2-3");
  });
  it("un bot bloque un adversaire sur le chiffre qui lui manque", () => {
    // Le siège 1 (adversaire du bot 0) a déjà passé sur le 5.
    const s = state({
      hands: [["2-5", "2-4", "6-6"], ["0-0"], ["1-1"], ["3-3"]],
      chain: [placed("2-2", 2, 2)],
      bots: [0],
      misses: [[], [5], [], []],
    });
    expect(chooseBotMove(s, 0)?.tile).toBe("2-5");
  });
  it("une partie entière avec 3 bots va jusqu'au bout", () => {
    const rng = seededRng(21);
    let g = createDominoGame(opts(), rng, NOW, [1, 2, 3]);
    let now = NOW;
    for (let i = 0; i < 5000 && g.phase !== "gameOver"; i++) {
      now += 60_000;
      const r = applyTimeout(g, rng, now);
      if (!r.ok) throw new Error(r.error);
      g = r.state;
    }
    expect(g.phase).toBe("gameOver");
    expect(Math.max(...g.scores)).toBeGreaterThanOrEqual(100);
  });
});
