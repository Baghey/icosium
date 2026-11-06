import { describe, expect, it } from "vitest";
import {
  DEFAULT_RONDA_OPTIONS,
  type RondaCard,
  type RondaEvent,
  type RondaOptions,
  type RondaState,
  applyRondaAction,
  applyRondaTimeout,
  captureFor,
  chooseRondaBotCard,
  createRondaGame,
  drawStartTable,
  parseRondaOptions,
  rondaCombo,
  rondaDeck,
  rondaPublicView,
  rondaValue,
  shuffleRonda,
} from "../src";

const T0 = 1_000_000;
const rng0 = () => 0;

/** Une partie dont on fixe la table, les mains et la pioche à la main. */
function game(
  setup: { table: RondaCard[]; hands: RondaCard[][]; deck?: RondaCard[]; turn?: number; dealer?: number; scores?: [number, number] },
  options: Partial<RondaOptions> = {},
): RondaState {
  const players = setup.hands.length as 2 | 4;
  const s = createRondaGame({ ...DEFAULT_RONDA_OPTIONS, players, ...options }, rng0, T0, [], { dealer: setup.dealer ?? players - 1 });
  s.table = [...setup.table];
  s.hands = setup.hands.map((h) => [...h]);
  s.dealt = setup.hands.map((h) => [...h]);
  s.deck = [...(setup.deck ?? [])];
  s.piles = [[], []];
  s.turn = setup.turn ?? 0;
  if (setup.scores) s.scores = [...setup.scores];
  s.events = [];
  return s;
}

function play(s: RondaState, card: RondaCard, announce?: "ronda" | "tringa"): RondaState {
  const r = applyRondaAction(s, s.turn, { type: "play", card, ...(announce ? { announce } : {}) }, rng0, T0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

const playEvent = (s: RondaState) => s.events.find((e): e is Extract<RondaEvent, { type: "play" }> => e.type === "play");

describe("le paquet", () => {
  it("a 40 cartes, As à 7 puis Valet, Dame, Roi", () => {
    const deck = rondaDeck();
    expect(deck).toHaveLength(40);
    expect(new Set(deck).size).toBe(40);
    expect(deck.some((c) => c.startsWith("8") || c.startsWith("9") || c.startsWith("10"))).toBe(false);
    expect(rondaValue("7H")).toBe(7);
    expect(rondaValue("JS")).toBe(8); // le Valet suit le 7
    expect(rondaValue("KD")).toBe(10);
  });

  it("pose 4 cartes de départ toutes différentes et sans suite", () => {
    for (let i = 0; i < 300; i++) {
      let seed = i + 1;
      const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const { table, deck } = drawStartTable(shuffleRonda(rondaDeck(), rng));
      expect(table).toHaveLength(4);
      expect(deck).toHaveLength(36);
      const values = table.map(rondaValue).sort((a, b) => a - b);
      for (let k = 1; k < 4; k++) expect((values[k] as number) - (values[k - 1] as number)).toBeGreaterThan(1);
    }
  });

  it("remplace une carte fautive par la suivante du paquet", () => {
    const { table } = drawStartTable(["5H", "5S", "6C", "AH", "3D", "KS", "QS", "7S"] as RondaCard[]);
    expect(table).toEqual(["5H", "AH", "3D", "KS"]);
  });

  it("lit les réglages du Patron sans accepter n'importe quoi", () => {
    expect(parseRondaOptions({ players: 3, target: 99, turnSeconds: 7 })).toEqual(DEFAULT_RONDA_OPTIONS);
    expect(parseRondaOptions({ players: 2, target: 25, turnSeconds: 0, botAllowed: true })).toEqual({ players: 2, target: 25, turnSeconds: 0, botAllowed: true });
  });
});

describe("la donne", () => {
  it("donne 3 cartes à chacun et 4 sur la table, puis 3 à chaque donne", () => {
    for (const players of [2, 4] as const) {
      const s = createRondaGame({ ...DEFAULT_RONDA_OPTIONS, players }, Math.random, T0);
      expect(s.table).toHaveLength(4);
      expect(s.hands.every((h) => h.length === 3)).toBe(true);
      expect(s.deck).toHaveLength(36 - 3 * players);
      expect(s.turn).toBe((s.dealer + 1) % players);
    }
  });
});

describe("la capture", () => {
  it("prend la carte de même valeur et la suite montante", () => {
    // L'exemple du cahier des charges : 6, 7, Valet et Roi ; un 6 prend 6, 7, Valet ; le Roi reste.
    expect(captureFor(["6H", "7S", "JD", "KC"], 6)).toEqual(["6H", "7S", "JD"]);
    const s = play(game({ table: ["6H", "7S", "JD", "KC"], hands: [["6S", "2C", "3C"], ["AH", "AD", "4C"]] }), "6S");
    expect(s.table).toEqual(["KC"]);
    expect(s.piles[0]).toEqual(["6S", "6H", "7S", "JD"]);
    expect(s.lastCapturer).toBe(0);
  });

  it("laisse la carte sur la table quand elle ne prend rien", () => {
    const s = play(game({ table: ["6H", "KC"], hands: [["2C", "3C", "4C"], ["AH", "AD", "4D"]] }), "2C");
    expect(s.table).toEqual(["6H", "KC", "2C"]);
    expect(s.piles[0]).toEqual([]);
    expect(s.turn).toBe(1);
  });

  it("refuse une carte qui n'est pas dans la main, ou hors de son tour", () => {
    const s = game({ table: ["6H"], hands: [["2C", "3C", "4C"], ["AH", "AD", "4D"]] });
    expect(applyRondaAction(s, 0, { type: "play", card: "KS" }, rng0, T0)).toEqual({ ok: false, error: "not_in_hand" });
    expect(applyRondaAction(s, 1, { type: "play", card: "AH" }, rng0, T0)).toEqual({ ok: false, error: "not_your_turn" });
  });
});

describe("les caïdas", () => {
  it("caïda : prendre la carte que l'adversaire vient de poser = 1 point", () => {
    let s = game({ table: ["KC", "2D"], hands: [["5H", "AC", "QD"], ["5S", "6S", "3H"]] });
    s = play(s, "5H");
    s = play(s, "5S");
    expect(playEvent(s)?.caida).toBe(1);
    expect(s.scores).toEqual([0, 1]);
  });

  it("pas de caïda quand la carte prise était déjà sur la table", () => {
    let s = game({ table: ["5D", "KC"], hands: [["2H", "AC", "QD"], ["5S", "6S", "3H"]] });
    s = play(s, "2H");
    s = play(s, "5S");
    expect(playEvent(s)?.caida).toBe(0);
    expect(s.scores).toEqual([0, 0]);
  });

  it("pas de point quand la carte posée est prise dans une suite", () => {
    // Un 3 sur la table, l'adversaire pose un 4, un 3 prend les deux : pas de caïda.
    let s = game({ table: ["3D", "KC"], hands: [["4H", "AC", "QD"], ["3S", "6S", "6H"]] });
    s = play(s, "4H");
    s = play(s, "3S");
    expect(playEvent(s)?.captured).toEqual(["3D", "4H"]);
    expect(playEvent(s)?.caida).toBe(0);
  });

  it("à 4 : khamsa (5 points) puis achra (10 points), on reprend tout", () => {
    let s = game({
      table: ["KC", "2D"],
      hands: [["5H", "AC", "QD"], ["5S", "AS", "3H"], ["5C", "6C", "AD"], ["5D", "6D", "3S"]],
    });
    s = play(s, "5H");
    s = play(s, "5S");
    expect(s.scores).toEqual([0, 1]);
    s = play(s, "5C");
    expect(playEvent(s)?.caida).toBe(5);
    expect(playEvent(s)?.stolen.sort()).toEqual(["5H", "5S"]);
    expect(s.scores).toEqual([5, 1]);
    expect(s.piles[1]).toEqual([]);
    expect(s.piles[0]).toHaveLength(3);
    s = play(s, "5D");
    expect(playEvent(s)?.caida).toBe(10);
    expect(s.scores).toEqual([5, 11]);
    expect(s.piles[0]).toEqual([]);
    expect(s.piles[1].sort()).toEqual(["5C", "5D", "5H", "5S"]);
  });

  it("à 2 : pas de khamsa, la 3e carte se pose simplement", () => {
    let s = game({ table: ["KC", "2D"], hands: [["5H", "5C", "QD"], ["5S", "AS", "3H"]] });
    s = play(s, "5H");
    s = play(s, "5S");
    s = play(s, "5C");
    expect(playEvent(s)?.caida).toBe(0);
    expect(s.table).toContain("5C");
  });

  it("pas de caïda sur la dernière carte de la donne d'avant", () => {
    let s = game({ table: ["KC"], hands: [["2H"], ["5S"]], deck: ["5H", "AS", "AD", "3C", "4C", "6D"] });
    s = play(s, "2H");
    s = play(s, "5S"); // dernière carte de la donne : posée sur la table
    expect(s.deal).toBeGreaterThan(1);
    const before = s.scores[0];
    s = play(s, "5H");
    expect(playEvent(s)?.caida).toBe(0);
    expect(s.scores[0]).toBe(before);
  });
});

describe("la missa", () => {
  it("vider la table = 1 point (2 avec une caïda)", () => {
    const w = play(game({ table: ["KC", "QD"], hands: [["QS", "AC", "2D"], ["5S", "6S", "3H"]], deck: rondaDeck().slice(0, 6) }), "QS");
    expect(playEvent(w)?.captured).toEqual(["QD", "KC"]);
    expect(playEvent(w)?.missa).toBe(true);
    expect(w.scores).toEqual([1, 0]);
    // Table vide, l'adversaire pose un 5, on le prend : caïda + missa = 2 points.
    const y = play(play(game({ table: [], hands: [["5H", "AC", "QD"], ["5S", "6S", "3H"]], deck: rondaDeck().slice(0, 6) }), "5H"), "5S");
    expect(playEvent(y)?.caida).toBe(1);
    expect(playEvent(y)?.missa).toBe(true);
    expect(y.scores).toEqual([0, 2]);
    // Une carte reste sur la table : pas de missa.
    const z = play(game({ table: ["KC", "5D"], hands: [["5H", "AC", "QD"], ["5S", "6S", "3H"]] }), "5H");
    expect(playEvent(z)?.missa).toBe(false);
  });

  it("pas de missa avec la toute dernière carte de la manche", () => {
    let s = game({ table: ["KC"], hands: [["2H"], ["KS"]], deck: [] });
    s = play(s, "2H");
    s = play(s, "KS"); // prend le Roi, mais le 2 reste : pas une missa
    expect(playEvent(s)?.missa).toBe(false);
    let t = game({ table: ["KC"], hands: [["AH"], ["KS"]], deck: [], scores: [0, 0] });
    t = play(t, "AH");
    const last = applyRondaAction({ ...t, table: ["KC"] }, 1, { type: "play", card: "KS" }, rng0, T0);
    expect(last.ok && last.state.events.find((e) => e.type === "play")).toMatchObject({ missa: false });
  });
});

describe("les annonces", () => {
  it("lit les paires et les brelans", () => {
    expect(rondaCombo(["5H", "5S", "KC"])).toEqual({ kind: "ronda", value: 5 });
    expect(rondaCombo(["5H", "5S", "5C"])).toEqual({ kind: "tringa", value: 5 });
    expect(rondaCombo(["5H", "6S", "KC"])).toBeNull();
  });

  const finishDeal = (s: RondaState) => {
    let x = s;
    while (x.hands.some((h) => h.length) && x.phase === "play" && x.deal === s.deal) x = play(x, chooseRondaBotCard(x, x.turn));
    return x;
  };
  const outcomes = (s: RondaState) => s.events.find((e): e is Extract<RondaEvent, { type: "announces" }> => e.type === "announces");

  it("ronda annoncée = 1 point à la fin de la donne", () => {
    const s = finishDeal(play(game({ table: ["KC"], hands: [["5H", "5S", "2C"], ["AH", "3D", "QS"]], deck: rondaDeck().slice(0, 6) }), "2C", "ronda"));
    expect(outcomes(s)?.points).toEqual([1, 0]);
  });

  it("la meilleure annonce gagne tout : tringa bat ronda, puis la plus haute valeur", () => {
    const a = finishDeal(play(game({ table: ["KC"], hands: [["5H", "5S", "2C"], ["AH", "AD", "AS"]], deck: rondaDeck().slice(0, 6) }), "2C", "ronda"));
    // Le joueur 1 annonce au moment de jouer… mais ici il a oublié : ronda du 0 gagne, tringa oubliée = 5 au 0.
    expect(outcomes(a)?.points).toEqual([6, 0]);
    let b = game({ table: ["KC"], hands: [["5H", "5S", "2C"], ["AH", "AD", "AS"]], deck: rondaDeck().slice(0, 6) });
    b = play(b, "2C", "ronda");
    b = play(b, "AH", "tringa");
    b = finishDeal(b);
    expect(outcomes(b)?.points).toEqual([0, 6]);
    let c = game({ table: ["KC"], hands: [["5H", "5S", "2C"], ["QH", "QD", "AS"]], deck: rondaDeck().slice(0, 6) });
    c = play(c, "2C", "ronda");
    c = play(c, "AS", "ronda");
    c = finishDeal(c);
    expect(outcomes(c)?.points).toEqual([0, 2]);
  });

  it("annonce oubliée : le point va à l'adversaire", () => {
    const s = finishDeal(play(game({ table: ["KC"], hands: [["5H", "5S", "2C"], ["AH", "3D", "QS"]], deck: rondaDeck().slice(0, 6) }), "2C"));
    expect(outcomes(s)?.outcomes[0]).toMatchObject({ seat: 0, result: "forgot" });
    expect(outcomes(s)?.points).toEqual([0, 1]);
  });

  it("bluff découvert : les points vont à l'adversaire", () => {
    const s = finishDeal(play(game({ table: ["KC"], hands: [["5H", "6S", "2C"], ["AH", "3D", "QS"]], deck: rondaDeck().slice(0, 6) }), "2C", "tringa"));
    expect(outcomes(s)?.outcomes[0]).toMatchObject({ seat: 0, result: "bluff" });
    expect(outcomes(s)?.points).toEqual([0, 5]);
  });

  it("à 4 : deux rondas égales chez deux adversaires, on partage", () => {
    let s = game({
      table: ["KC"],
      hands: [["5H", "5S", "2C"], ["5C", "5D", "3C"], ["AH", "4D", "QS"], ["AS", "4H", "QD"]],
      deck: rondaDeck().slice(0, 12),
    });
    s = play(s, "2C", "ronda");
    s = play(s, "3C", "ronda");
    s = finishDeal(s);
    expect(outcomes(s)?.points).toEqual([1, 1]);
  });

  it("on ne peut plus annoncer après sa première carte", () => {
    let s = game({ table: ["KC"], hands: [["5H", "5S", "2C"], ["AH", "3D", "QS"]], deck: rondaDeck().slice(0, 6) });
    s = play(s, "2C");
    expect(applyRondaAction(s, 0, { type: "announce", kind: "ronda" }, rng0, T0)).toEqual({ ok: false, error: "too_late" });
    // L'adversaire peut annoncer avant son tour.
    expect(applyRondaAction(s, 1, { type: "announce", kind: "ronda" }, rng0, T0).ok).toBe(true);
  });
});

describe("fin de manche et victoire", () => {
  it("les cartes de la table vont au dernier qui a pris, 1 point par carte au-delà de 20", () => {
    const s0 = game({ table: ["KC", "2D"], hands: [["KS"], ["5S"]], deck: [] });
    s0.piles = [rondaDeck().slice(0, 22) as RondaCard[], rondaDeck().slice(22, 34) as RondaCard[]];
    let s = play(s0, "KS");
    s = play(s, "5S");
    const sweep = s.events.find((e) => e.type === "sweep");
    expect(sweep).toMatchObject({ team: 0, cards: ["2D", "5S"] });
    const end = s.events.find((e): e is Extract<RondaEvent, { type: "roundEnd" }> => e.type === "roundEnd");
    expect(end?.counts).toEqual([26, 12]);
    expect(end?.points).toEqual([6, 0]);
    expect(s.round).toBe(2);
    expect(s.table).toHaveLength(4);
  });

  it("victoire immédiate à 41, même en pleine manche", () => {
    let s = game({ table: ["KC", "2D"], hands: [["5H", "AC", "QD"], ["5S", "6S", "3H"]], scores: [10, 40], deck: rondaDeck().slice(0, 6) });
    s = play(s, "5H");
    s = play(s, "5S");
    expect(s.phase).toBe("over");
    expect(s.winner).toBe(1);
    expect(s.events.at(-1)).toEqual({ type: "win", team: 1 });
    expect(applyRondaAction(s, 0, { type: "play", card: "AC" }, rng0, T0)).toEqual({ ok: false, error: "game_over" });
  });

  it("partie courte à 25", () => {
    let s = game({ table: ["KC", "2D"], hands: [["5H", "AC", "QD"], ["5S", "6S", "3H"]], scores: [0, 24] }, { target: 25 });
    s = play(s, "5H");
    s = play(s, "5S");
    expect(s.winner).toBe(1);
  });
});

describe("parties entières", () => {
  it("les 40 cartes restent toujours là, et la partie se termine", () => {
    for (const players of [2, 4] as const) {
      for (let g = 0; g < 60; g++) {
        let seed = g * 7 + players;
        const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        let s = createRondaGame({ ...DEFAULT_RONDA_OPTIONS, players }, rng, T0, [0, 1, 2, 3].slice(0, players));
        let now = T0;
        let steps = 0;
        while (s.phase === "play" && steps < 5000) {
          now = (s.deadline ?? now) + 1;
          const r = applyRondaTimeout(s, rng, now);
          if (!r.ok) throw new Error(r.error);
          s = r.state;
          steps++;
          if (s.phase === "play") {
            const all = [...s.deck, ...s.table, ...s.piles[0], ...s.piles[1], ...s.hands.flat()];
            expect(all).toHaveLength(40);
            expect(new Set(all).size).toBe(40);
            expect(new Set(s.table.map(rondaValue)).size).toBe(s.table.length);
          }
        }
        expect(s.phase).toBe("over");
        expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(41);
      }
    }
  });

  it("le bot prend le plus possible, sinon pose sa plus petite carte", () => {
    const s = game({ table: ["6H", "7S", "JD", "2C"], hands: [["6S", "2D", "KC"], ["AH", "AD", "4C"]] });
    expect(chooseRondaBotCard(s, 0)).toBe("6S");
    const t = game({ table: ["6H"], hands: [["QS", "2D", "KC"], ["AH", "AD", "4C"]] });
    expect(chooseRondaBotCard(t, 0)).toBe("2D");
  });

  it("le chrono fini : le serveur joue (et annonce) à la place du joueur", () => {
    const s = game({ table: ["KC"], hands: [["5H", "5S", "2C"], ["AH", "3D", "QS"]], deck: rondaDeck().slice(0, 6) });
    s.deadline = T0 + 10;
    expect(applyRondaTimeout(s, rng0, T0).ok).toBe(false);
    const r = applyRondaTimeout(s, rng0, T0 + 11);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.announced[0]).toBe("ronda");
      expect(r.state.hands[0]).toHaveLength(2);
    }
  });
});

describe("la vue publique", () => {
  it("ne contient jamais les mains ni la pioche", () => {
    const s = createRondaGame({ ...DEFAULT_RONDA_OPTIONS, players: 4 }, Math.random, T0);
    const view = rondaPublicView(s) as unknown as Record<string, unknown>;
    expect(view.hands).toBeUndefined();
    expect(view.deck).toBeUndefined();
    expect(view.dealt).toBeUndefined();
    expect(view.piles).toBeUndefined();
    expect(view.handCounts).toEqual([3, 3, 3, 3]);
    const text = JSON.stringify(view);
    for (const card of s.hands.flat()) expect(text.includes(`"${card}"`)).toBe(false);
  });
});
