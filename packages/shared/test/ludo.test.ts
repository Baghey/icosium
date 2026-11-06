import { describe, expect, it } from "vitest";
import {
  DEFAULT_LUDO_OPTIONS,
  FINISH_STEP,
  type LudoOptions,
  type LudoState,
  START_INDEX,
  applyLudoAction,
  applyLudoMove,
  applyLudoRoll,
  applyLudoTimeout,
  capturesAt,
  chooseLudoBotMove,
  createLudoGame,
  dangerOf,
  isSafeTrackIndex,
  ludoPublicView,
  movablePawns,
  parseLudoOptions,
  targetStep,
  trackIndexOf,
} from "../src";

const T0 = 1_000_000;
const first = () => 0; // rng qui donne la main à la chaise 0

function game(options: Partial<LudoOptions> = {}, pawns?: number[][]): LudoState {
  const s = createLudoGame({ ...DEFAULT_LUDO_OPTIONS, ...options }, first, T0);
  if (pawns) s.pawns = pawns.map((p) => [...p]);
  return s;
}

function roll(s: LudoState, value: number, autoMove = true): LudoState {
  const r = applyLudoRoll(s, s.turn, value, T0, autoMove);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

function move(s: LudoState, pawn: number): LudoState {
  const r = applyLudoMove(s, s.turn, pawn, T0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

const H = -1; // à la maison

describe("plateau", () => {
  it("place les départs et les étoiles au bon endroit", () => {
    expect(trackIndexOf("red", 0)).toBe(0);
    expect(trackIndexOf("green", 0)).toBe(13);
    expect(trackIndexOf("blue", 50)).toBe((START_INDEX.blue + 50) % 52);
    expect(trackIndexOf("red", 51)).toBeNull();
    for (const i of [0, 8, 13, 21, 26, 34, 39, 47]) expect(isSafeTrackIndex(i)).toBe(true);
    expect(isSafeTrackIndex(5)).toBe(false);
  });

  it("demande le chiffre exact pour entrer au centre", () => {
    expect(targetStep(53, 3)).toBe(FINISH_STEP);
    expect(targetStep(53, 4)).toBeNull();
    expect(targetStep(FINISH_STEP, 1)).toBeNull();
  });
});

describe("réglages", () => {
  it("garde seulement les valeurs permises", () => {
    expect(parseLudoOptions({ players: 9, pawnsToWin: 7, turnSeconds: 3, botAllowed: "yes" })).toEqual(DEFAULT_LUDO_OPTIONS);
    expect(parseLudoOptions({ players: 2, teams: true }).teams).toBe(false);
    expect(parseLudoOptions({ players: 4, teams: true, pawnsToWin: 2 })).toMatchObject({ teams: true, pawnsToWin: 2 });
  });

  it("donne les bonnes couleurs selon le nombre de joueurs", () => {
    expect(game({ players: 2 }).colors).toEqual(["red", "yellow"]);
    expect(game({ players: 3 }).colors).toEqual(["red", "green", "yellow"]);
    expect(game({ players: 4 }).colors).toEqual(["red", "green", "yellow", "blue"]);
  });
});

describe("sortir de la maison", () => {
  it("n'est possible qu'avec un 6", () => {
    for (const v of [1, 2, 3, 4, 5]) {
      const s = roll(game(), v);
      expect(s.events.some((e) => e.type === "noMove")).toBe(true);
      expect(s.turn).toBe(1);
      expect(s.pawns[0]).toEqual([H, H, H, H]);
    }
    const s = roll(game(), 6);
    // Tous les pions de la maison se valent : le serveur sort le premier tout de suite.
    expect(s.pawns[0]).toEqual([0, H, H, H]);
  });

  it("laisse choisir quand plusieurs pions différents peuvent bouger", () => {
    const s = roll(game({}, [[10, H, H, H], [H, H, H, H], [H, H, H, H], [H, H, H, H]]), 6);
    expect(s.phase).toBe("move");
    expect(s.movable).toEqual([0, 1, 2, 3]);
    const after = move(s, 2);
    expect(after.pawns[0]).toEqual([10, H, 0, H]);
  });

  it("refuse un pion qui ne peut pas bouger, ou une action hors de son tour", () => {
    const s = roll(game({}, [[10, H, H, H], [H, H, H, H], [H, H, H, H], [H, H, H, H]]), 3, false);
    expect(s.movable).toEqual([0]);
    expect(applyLudoMove(s, 0, 1, T0)).toEqual({ ok: false, error: "illegal_move" });
    expect(applyLudoMove(s, 1, 0, T0)).toEqual({ ok: false, error: "not_your_turn" });
    expect(applyLudoRoll(s, 0, 4, T0)).toEqual({ ok: false, error: "must_move" });
    expect(applyLudoMove(game(), 0, 0, T0)).toEqual({ ok: false, error: "must_roll" });
  });
});

describe("les 6", () => {
  it("un 6 fait rejouer", () => {
    const s = roll(game({}, [[10, H, H, H], [H, H, H, H], [H, H, H, H], [H, H, H, H]]), 6);
    const after = move(s, 0);
    expect(after.turn).toBe(0);
    expect(after.phase).toBe("roll");
    expect(after.events).toContainEqual({ type: "bonus", seat: 0, reason: "six" });
  });

  it("un 6 sans coup possible fait quand même rejouer", () => {
    const s = roll(game({}, [[FINISH_STEP, FINISH_STEP, 54, 53], [H, H, H, H], [H, H, H, H], [H, H, H, H]]), 6);
    expect(s.events.some((e) => e.type === "noMove")).toBe(true);
    expect(s.turn).toBe(0);
    expect(s.phase).toBe("roll");
  });

  it("trois 6 de suite : le tour est perdu", () => {
    let s = game({}, [[10, 20, H, H], [H, H, H, H], [H, H, H, H], [H, H, H, H]]);
    s = move(roll(s, 6), 0); // 16
    s = move(roll(s, 6), 0); // 22
    expect(s.sixes).toBe(2);
    s = roll(s, 6);
    expect(s.events).toContainEqual({ type: "threeSixes", seat: 0 });
    expect(s.turn).toBe(1);
    expect(s.pawns[0]).toEqual([22, 20, H, H]); // le troisième 6 ne bouge rien
    expect(s.sixes).toBe(0);
  });

  it("un autre chiffre entre deux 6 remet le compte à zéro", () => {
    let s = game({ players: 2 }, [[10, H, H, H], [H, H, H, H]]);
    s = move(roll(s, 6), 0);
    s = roll(s, 2); // fin du tour
    expect(s.turn).toBe(1);
    expect(s.sixes).toBe(0);
  });
});

describe("manger", () => {
  it("renvoie le pion adverse à sa maison, et on rejoue", () => {
    // Le vert (chaise 1) est sur la case 5 du circuit ; le rouge est en 2 et fait 3.
    const s = roll(game({}, [[2, H, H, H], [44, H, H, H], [H, H, H, H], [H, H, H, H]]), 3);
    expect(trackIndexOf("green", 44)).toBe(5);
    expect(s.pawns[0]).toEqual([5, H, H, H]);
    expect(s.pawns[1]).toEqual([H, H, H, H]);
    const mv = s.events.find((e) => e.type === "move");
    expect(mv && mv.type === "move" && mv.captured).toEqual([{ seat: 1, pawn: 0, from: 44 }]);
    expect(s.turn).toBe(0);
    expect(s.phase).toBe("roll");
    expect(s.events).toContainEqual({ type: "bonus", seat: 0, reason: "capture" });
  });

  it("mange tous les pions adverses de la case : il n'y a pas de mur", () => {
    const s = roll(game({}, [[2, H, H, H], [44, 44, H, H], [H, H, H, H], [H, H, H, H]]), 3);
    expect(s.pawns[1]).toEqual([H, H, H, H]);
  });

  it("deux pions de même couleur ne bloquent pas le passage", () => {
    // Deux verts sur la case 5 : le rouge passe par-dessus et va plus loin.
    const s = roll(game({}, [[2, H, H, H], [44, 44, H, H], [H, H, H, H], [H, H, H, H]]), 5);
    expect(s.pawns[0]).toEqual([7, H, H, H]);
    expect(s.pawns[1]).toEqual([44, 44, H, H]);
  });

  it("personne n'est mangé sur une case étoilée", () => {
    // Case 8 = étoile. Le vert y est (progression 47), le rouge arrive dessus.
    expect(trackIndexOf("green", 47)).toBe(8);
    const s = roll(game({}, [[4, H, H, H], [47, H, H, H], [H, H, H, H], [H, H, H, H]]), 4);
    expect(s.pawns[0]).toEqual([8, H, H, H]);
    expect(s.pawns[1]).toEqual([47, H, H, H]);
    expect(s.turn).toBe(1); // pas de bonus
  });

  it("personne n'est mangé sur une case de départ", () => {
    // Un pion vert sur la case de départ du rouge (case 0) : le rouge sort sans le manger.
    const s = roll(game({}, [[H, H, H, H], [39, H, H, H], [H, H, H, H], [H, H, H, H]]), 6);
    expect(s.pawns[1]).toEqual([39, H, H, H]);
    expect(s.pawns[0]).toEqual([0, H, H, H]);
  });

  it("on ne mange jamais son partenaire en équipes", () => {
    const pawns = [[2, H, H, H], [H, H, H, H], [31, H, H, H], [H, H, H, H]];
    expect(trackIndexOf("yellow", 31)).toBe(5);
    expect(capturesAt(game({ teams: true }, pawns), 0, 5)).toEqual([]);
    expect(capturesAt(game({ teams: false }, pawns), 0, 5)).toEqual([{ seat: 2, pawn: 0, from: 31 }]);
  });
});

describe("entrer au centre", () => {
  it("faut le chiffre exact", () => {
    let s = game({ players: 2 }, [[53, FINISH_STEP, FINISH_STEP, FINISH_STEP], [H, H, H, H]]);
    s = roll(s, 5);
    expect(s.events.some((e) => e.type === "noMove")).toBe(true);
    expect(s.pawns[0]?.[0]).toBe(53);
    s = roll(s, 1); // l'autre joueur ne fait rien
    s = roll(s, 3);
    expect(s.winners).toEqual([0]);
    expect(s.phase).toBe("over");
  });
});

describe("victoire", () => {
  for (const need of [1, 2, 3, 4] as const) {
    it(`avec ${need} pion(s) à rentrer`, () => {
      const mine = [54, 54, 54, 54].map((p, i) => (i < need - 1 ? FINISH_STEP : p));
      let s = game({ players: 2, pawnsToWin: need }, [mine, [H, H, H, H]]);
      s = roll(s, 2, false);
      s = move(s, s.movable[0] as number);
      expect(s.winners).toEqual([0]);
      expect(s.events.some((e) => e.type === "win")).toBe(true);
      expect(applyLudoRoll(s, s.turn, 3, T0)).toEqual({ ok: false, error: "game_over" });
    });
  }

  it("pas avant le nombre demandé", () => {
    let s = game({ players: 2, pawnsToWin: 2 }, [[54, 10, H, H], [H, H, H, H]]);
    s = roll(s, 2);
    expect(s.winners).toBeNull();
    expect(s.done).toEqual([]);
  });
});

describe("partie à 2 contre 2", () => {
  it("celui qui a fini joue les pions de son partenaire, et l'équipe gagne ensemble", () => {
    let s = game({ players: 4, teams: true, pawnsToWin: 1 }, [[54, H, H, H], [H, H, H, H], [40, H, H, H], [H, H, H, H]]);
    s = roll(s, 2); // le rouge (0) rentre son pion
    expect(s.done).toEqual([0]);
    expect(s.winners).toBeNull(); // son partenaire jaune (2) n'a pas fini
    expect(s.turn).toBe(1);
    s = roll(s, 1); // vert : rien
    s = roll(s, 1); // jaune : 41
    s = roll(s, 1); // bleu : rien
    expect(s.turn).toBe(0);
    expect(s.mover).toBe(2);
    s = move(roll(s, 6), 0); // le rouge joue pour le jaune : 41 → 47
    expect(s.pawns[2]?.[0]).toBe(47);
    s = roll(s, 3); // bonus du 6 : 47 → 50
    expect(s.pawns[2]?.[0]).toBe(50);
    s = roll(s, 1); // vert
    s = move(roll(s, 6), 0); // jaune lui-même : 50 → 56
    expect(s.winners).toEqual([0, 2]);
  });
});

describe("chrono et bots", () => {
  it("le serveur joue pour l'humain absent quand le temps est fini", () => {
    const s = game({ players: 2 }, [[10, 20, H, H], [H, H, H, H]]);
    expect(applyLudoTimeout(s, () => 0.5, T0)).toEqual({ ok: false, error: "not_expired" });
    const r = applyLudoTimeout(s, () => 0.5, (s.deadline as number) + 1); // dé = 4
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.events.filter((e) => e.type === "roll" || e.type === "move")).toHaveLength(2);
    expect(r.state.turn).toBe(1);
  });

  it("un bot lance puis bouge, sans attendre le chrono des humains", () => {
    const s = createLudoGame({ ...DEFAULT_LUDO_OPTIONS, players: 2, botAllowed: true }, first, T0, [0]);
    expect(s.deadline).toBeLessThan(T0 + 2000);
  });

  it("le bot mange d'abord, puis sort un pion, puis sauve le pion en danger", () => {
    // Le rouge (en 2) peut manger le vert sur la case 5.
    let s = roll(game({}, [[2, H, 30, H], [44, H, H, H], [H, H, H, H], [H, H, H, H]]), 3, false);
    expect(chooseLudoBotMove(s)).toBe(0);
    s = roll(game({}, [[10, H, H, H], [H, H, H, H], [H, H, H, H], [H, H, H, H]]), 6, false);
    expect(chooseLudoBotMove(s)).toBe(1);
    // Le pion en 20 a un vert 3 cases derrière lui : le bot le sauve.
    const p = [[5, 20, H, H], [H, H, H, H], [H, H, H, H], [H, H, H, H]];
    p[1] = [4, H, H, H]; // vert en progression 4 = case 17
    s = roll(game({}, p), 2, false);
    expect(dangerOf(s, 0, 20)).toBe(1);
    expect(chooseLudoBotMove(s)).toBe(1);
  });
});

describe("vue publique", () => {
  it("ne partage pas la mémoire avec l'état", () => {
    const s = game();
    const v = ludoPublicView(s);
    v.pawns[0]![0] = 3;
    expect(s.pawns[0]![0]).toBe(H);
  });
});

/** Petit générateur au hasard reproductible. */
function seeded(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

describe("parties complètes au hasard", () => {
  it("se terminent toujours, sans pion perdu ni case interdite", () => {
    for (let g = 0; g < 500; g++) {
      const rng = seeded(g + 1);
      const options = parseLudoOptions({
        players: [2, 3, 4][g % 3],
        teams: g % 5 === 0,
        pawnsToWin: (g % 4) + 1,
      });
      let s = createLudoGame(options, rng, 0);
      let n = 0;
      while (s.phase !== "over") {
        const r = s.phase === "roll" ? applyLudoAction(s, s.turn, { type: "roll" }, rng, 0) : applyLudoAction(s, s.turn, { type: "move", pawn: chooseLudoBotMove(s) }, rng, 0);
        if (!r.ok) throw new Error(r.error);
        s = r.state;
        for (const pawns of s.pawns) {
          if (pawns.length !== 4 || pawns.some((p) => p < -1 || p > FINISH_STEP)) throw new Error("pion perdu");
        }
        // Jamais deux couleurs ennemies sur une case du circuit, sauf sur une case sûre.
        const seen = new Map<number, number>();
        s.pawns.forEach((pawns, seat) =>
          pawns.forEach((p) => {
            const i = trackIndexOf(s.colors[seat]!, p);
            if (i === null || isSafeTrackIndex(i)) return;
            const other = seen.get(i);
            if (other !== undefined && other !== seat && !(s.options.teams && other % 2 === seat % 2)) throw new Error(`case ${i} partagée`);
            seen.set(i, seat);
          }),
        );
        if (++n > 20000) throw new Error("partie sans fin");
      }
      expect(s.winners?.length).toBe(options.teams ? 2 : 1);
      for (const w of s.winners ?? []) expect(s.pawns[w]!.filter((p) => p === FINISH_STEP).length).toBeGreaterThanOrEqual(options.pawnsToWin);
    }
  });

  it("propose toujours les bons pions", () => {
    const s = game({}, [[H, 50, 53, FINISH_STEP], [H, H, H, H], [H, H, H, H], [H, H, H, H]]);
    expect(movablePawns(s, 0, 6)).toEqual([0, 1]);
    expect(movablePawns(s, 0, 3)).toEqual([1, 2]);
    expect(movablePawns(s, 0, 4)).toEqual([1]);
  });
});
