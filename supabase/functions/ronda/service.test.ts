import { describe, expect, it } from "vitest";
import { MemoryStore } from "./memory-store.ts";
import { type Deps, TABLE_CREATE_LIMIT, handle } from "./service.ts";

function seeded(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function setup() {
  let now = 1_000_000;
  const clock = { now: () => now, advance: (ms: number) => (now += ms) };
  const store = new MemoryStore(clock.now);
  const deps: Deps = { store, rng: seeded(42), now: clock.now };
  return { store, deps, clock };
}

async function fullTable(options: Record<string, unknown> = { players: 4 }) {
  const env = setup();
  const created = await handle(env.deps, "u0", { op: "create", options });
  const code = created.body.code as string;
  const tableId = created.body.tableId as string;
  const players = (options.players as number) ?? 4;
  for (let i = 1; i < players; i++) await handle(env.deps, `u${i}`, { op: "join", code });
  return { ...env, code, tableId };
}

describe("tables de Ronda", () => {
  it("crée une table, assoit le Patron, garde ses réglages", async () => {
    const { deps, store } = setup();
    const r = await handle(deps, "u0", { op: "create", options: { players: 2, target: 25 } });
    expect(r.status).toBe(200);
    expect(r.body.code).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(await store.seats(r.body.tableId as string)).toEqual([{ seat: 0, userId: "u0", username: "player_u0" }]);
    expect((await store.tableById(r.body.tableId as string))?.options).toMatchObject({ players: 2, target: 25, botAllowed: false });
  });

  it("n'utilise jamais le code d'une table de domino", async () => {
    const { deps, store } = setup();
    // Le premier code tiré par ce générateur est pris par une table de domino.
    const firstCode = (await handle(setup().deps, "x", { op: "create" })).body.code as string;
    store.otherCodes.add(firstCode);
    const r = await handle(deps, "u0", { op: "create" });
    expect(r.body.code).not.toBe(firstCode);
  });

  it("limite la création de tables, domino compris (anti-spam)", async () => {
    const { deps, store } = setup();
    store.otherTables = 2;
    for (let i = 0; i < TABLE_CREATE_LIMIT - 2; i++) expect((await handle(deps, "u0", { op: "create" })).status).toBe(200);
    expect((await handle(deps, "u0", { op: "create" })).body.error).toBe("rate_limited");
  });

  it("ne démarre qu'avec tous les humains, sans bot par défaut", async () => {
    const { deps, store } = setup();
    const r = await handle(deps, "u0", { op: "create", options: { players: 2 } });
    expect(await store.loadGame(r.body.tableId as string)).toBeNull();
    await handle(deps, "u1", { op: "join", code: r.body.code });
    const g = await store.loadGame(r.body.tableId as string);
    expect(g?.state.bots).toEqual([]);
    expect((await store.tableById(r.body.tableId as string))?.status).toBe("playing");
  });

  it("refuse une personne de trop, mais laisse revenir un joueur assis", async () => {
    const { deps, code } = await fullTable({ players: 2 });
    expect((await handle(deps, "u9", { op: "join", code })).body.error).toBe("table_started");
    expect((await handle(deps, "u1", { op: "join", code })).status).toBe(200);
  });

  it("seul le Patron peut appeler des bots", async () => {
    const { deps, store } = setup();
    const r = await handle(deps, "u0", { op: "create", options: { players: 4 } });
    await handle(deps, "u1", { op: "join", code: r.body.code });
    expect((await handle(deps, "u1", { op: "bots", tableId: r.body.tableId })).body.error).toBe("not_host");
    expect((await handle(deps, "u0", { op: "bots", tableId: r.body.tableId })).status).toBe(200);
    const seats = await store.seats(r.body.tableId as string);
    expect(seats.filter((s) => s.isBot)).toHaveLength(2);
    expect((await store.loadGame(r.body.tableId as string))?.state.bots).toEqual([2, 3]);
  });

  it("partie seul contre des bots", async () => {
    const { deps, store } = setup();
    const r = await handle(deps, "u0", { op: "create", options: { players: 4 }, solo: true });
    const g = await store.loadGame(r.body.tableId as string);
    expect(g?.state.bots).toEqual([1, 2, 3]);
  });
});

describe("pendant la partie", () => {
  it("chaque joueur ne reçoit que sa propre main, jamais celles des autres ni la pioche", async () => {
    const { store, tableId } = await fullTable({ players: 4 });
    const state = (await store.loadGame(tableId))!.state;
    const hands = store.hands.get(tableId)!;
    for (let seat = 0; seat < 4; seat++) expect(hands.get(`u${seat}`)).toEqual(state.hands[seat]);
    const view = JSON.stringify(store.views.get(tableId)!.view);
    for (const card of [...state.hands.flat(), ...state.deck]) expect(view.includes(`"${card}"`)).toBe(false);
  });

  it("refuse de jouer hors de son tour, une carte qu'on n'a pas, ou sans être assis", async () => {
    const { deps, store, tableId } = await fullTable({ players: 2 });
    const state = (await store.loadGame(tableId))!.state;
    const me = state.turn;
    const other = 1 - me;
    const mine = state.hands[me]![0]!;
    const theirs = state.hands[other]![0]!;
    expect((await handle(deps, `u${other}`, { op: "play", tableId, card: theirs })).body.error).toBe("not_your_turn");
    expect((await handle(deps, "u9", { op: "play", tableId, card: mine })).body.error).toBe("not_seated");
    expect((await handle(deps, `u${me}`, { op: "play", tableId, card: theirs })).body.error).toBe("not_in_hand");
    expect((await handle(deps, `u${me}`, { op: "play", tableId, card: "9H" })).body.error).toBe("invalid_card");
    expect((await handle(deps, `u${me}`, { op: "play", tableId, card: mine, announce: "carré" })).body.error).toBe("invalid_announce");
    expect((await handle(deps, `u${me}`, { op: "play", tableId, card: mine })).status).toBe(200);
    expect(store.hands.get(tableId)!.get(`u${me}`)).toHaveLength(2);
  });

  it("on peut annoncer avant son tour, une seule fois", async () => {
    const { deps, store, tableId } = await fullTable({ players: 2 });
    const state = (await store.loadGame(tableId))!.state;
    const other = 1 - state.turn;
    expect((await handle(deps, `u${other}`, { op: "announce", tableId, kind: "ronda" })).status).toBe(200);
    expect((await handle(deps, `u${other}`, { op: "announce", tableId, kind: "tringa" })).body.error).toBe("already_announced");
    expect(store.views.get(tableId)!.view.announced[other]).toBe("ronda");
  });

  it("joue à la place d'un joueur absent, seulement quand le temps est vraiment fini", async () => {
    const { deps, store, tableId, clock } = await fullTable({ players: 2 });
    const before = (await store.loadGame(tableId))!;
    expect((await handle(deps, "u0", { op: "tick", tableId })).body.changed).toBe(false);
    clock.advance(40_000);
    expect((await handle(deps, "u0", { op: "tick", tableId })).body.changed).toBe(true);
    expect((await store.loadGame(tableId))!.version).toBe(before.version + 1);
  });

  it("une partie à 4 contre des bots va jusqu'au bout", async () => {
    const { deps, store, clock } = setup();
    const r = await handle(deps, "u0", { op: "create", options: { players: 4, target: 25 }, solo: true });
    const tableId = r.body.tableId as string;
    for (let i = 0; i < 5000; i++) {
      const s = (await store.loadGame(tableId))!.state;
      if (s.phase === "over") break;
      if (s.turn === 0) await handle(deps, "u0", { op: "play", tableId, card: store.hands.get(tableId)!.get("u0")![0] });
      else {
        clock.advance(6000);
        await handle(deps, "u0", { op: "tick", tableId });
      }
    }
    const end = (await store.loadGame(tableId))!;
    expect(end.state.phase).toBe("over");
    expect((await store.tableById(tableId))?.status).toBe("finished");
    expect(store.views.get(tableId)?.view.winner).toBe(end.state.winner);
  });

  it("une partie à 2 contre 2 entre humains va jusqu'à 41", async () => {
    const { deps, store, tableId } = await fullTable({ players: 4 });
    for (let i = 0; i < 5000; i++) {
      const s = (await store.loadGame(tableId))!.state;
      if (s.phase === "over") break;
      const hand = store.hands.get(tableId)!.get(`u${s.turn}`)!;
      await handle(deps, `u${s.turn}`, { op: "play", tableId, card: hand[hand.length - 1] });
    }
    const s = (await store.loadGame(tableId))!.state;
    expect(s.phase).toBe("over");
    expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(41);
  });
});

describe("lobby : visibilité et personnes retirées", () => {
  it("une table est visible des amis par défaut, et le Patron peut choisir", async () => {
    const { deps, store } = setup();
    const a = await handle(deps, "u0", { op: "create", options: {} });
    const b = await handle(deps, "u1", { op: "create", options: {}, visibility: "public" });
    const c = await handle(deps, "u2", { op: "create", options: {}, visibility: "nimporte" });
    expect(store.tables.get(a.body.tableId as string)?.visibility).toBe("friends");
    expect(store.tables.get(b.body.tableId as string)?.visibility).toBe("public");
    expect(store.tables.get(c.body.tableId as string)?.visibility).toBe("friends");
  });
  it("une partie seul contre des bots n'apparaît jamais dans le lobby", async () => {
    const { deps, store } = setup();
    const r = await handle(deps, "u0", { op: "create", options: {}, solo: true, visibility: "public" });
    expect(store.tables.get(r.body.tableId as string)?.visibility).toBe("private");
  });
  it("une personne retirée par le Patron ne peut pas se rasseoir, même par le lien", async () => {
    const { deps, store } = setup();
    const r = await handle(deps, "u0", { op: "create", options: { players: 4 } });
    store.tables.get(r.body.tableId as string)?.kicked.push("u9");
    const j = await handle(deps, "u9", { op: "join", code: r.body.code });
    expect(j).toEqual({ status: 403, body: { ok: false, error: "kicked" } });
    expect((await handle(deps, "u1", { op: "join", code: r.body.code })).status).toBe(200);
  });
});
