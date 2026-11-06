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

describe("tables de Ludo", () => {
  it("crée une table, assoit le Patron, garde ses réglages", async () => {
    const { deps, store } = setup();
    const r = await handle(deps, "u0", { op: "create", options: { players: 3, pawnsToWin: 2 } });
    expect(r.status).toBe(200);
    expect(r.body.code).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(await store.seats(r.body.tableId as string)).toEqual([{ seat: 0, userId: "u0", username: "player_u0" }]);
    expect((await store.tableById(r.body.tableId as string))?.options).toMatchObject({ players: 3, pawnsToWin: 2, botAllowed: false });
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
  it("le dé est tiré par le serveur, jamais par le téléphone", async () => {
    const { deps, store, tableId } = await fullTable({ players: 2 });
    const state = (await store.loadGame(tableId))!.state;
    const who = `u${state.turn}`;
    const r = await handle(deps, who, { op: "roll", tableId, value: 6 });
    expect(r.status).toBe(200);
    const after = (await store.loadGame(tableId))!.state;
    const rollEvent = after.events.find((e) => e.type === "roll");
    expect(rollEvent && rollEvent.type === "roll" ? rollEvent.value : null).toBe(r.body.die);
  });

  it("refuse de jouer hors de son tour ou sans être assis", async () => {
    const { deps, store, tableId } = await fullTable({ players: 2 });
    const state = (await store.loadGame(tableId))!.state;
    const other = `u${1 - state.turn}`;
    expect((await handle(deps, other, { op: "roll", tableId })).body.error).toBe("not_your_turn");
    expect((await handle(deps, "u9", { op: "roll", tableId })).body.error).toBe("not_seated");
    expect((await handle(deps, `u${state.turn}`, { op: "move", tableId, pawn: 0 })).body.error).toBe("must_roll");
    expect((await handle(deps, `u${state.turn}`, { op: "move", tableId, pawn: "x" })).body.error).toBe("invalid_move");
  });

  it("joue à la place d'un joueur absent, seulement quand le temps est vraiment fini", async () => {
    const { deps, store, tableId, clock } = await fullTable({ players: 2 });
    const before = (await store.loadGame(tableId))!;
    expect((await handle(deps, "u0", { op: "tick", tableId })).body.changed).toBe(false);
    clock.advance(16_000);
    expect((await handle(deps, "u0", { op: "tick", tableId })).body.changed).toBe(true);
    expect((await store.loadGame(tableId))!.version).toBe(before.version + 1);
  });

  it("une partie à 4 contre des bots va jusqu'au bout", async () => {
    const { deps, store, clock } = setup();
    const r = await handle(deps, "u0", { op: "create", options: { players: 4, pawnsToWin: 1 }, solo: true });
    const tableId = r.body.tableId as string;
    for (let i = 0; i < 5000; i++) {
      const s = (await store.loadGame(tableId))!.state;
      if (s.phase === "over") break;
      if (s.turn === 0) {
        if (s.phase === "roll") await handle(deps, "u0", { op: "roll", tableId });
        else await handle(deps, "u0", { op: "move", tableId, pawn: s.movable[0] });
      } else {
        clock.advance(5000);
        await handle(deps, "u0", { op: "tick", tableId });
      }
    }
    const end = (await store.loadGame(tableId))!;
    expect(end.state.phase).toBe("over");
    expect((await store.tableById(tableId))?.status).toBe("finished");
    expect(store.views.get(tableId)?.view.winners).toEqual(end.state.winners);
  });

  it("une partie à 2 contre 2 entre humains va jusqu'au bout", async () => {
    const { deps, store, tableId } = await fullTable({ players: 4, teams: true, pawnsToWin: 1 });
    for (let i = 0; i < 5000; i++) {
      const s = (await store.loadGame(tableId))!.state;
      if (s.phase === "over") break;
      const who = `u${s.turn}`;
      if (s.phase === "roll") await handle(deps, who, { op: "roll", tableId });
      else await handle(deps, who, { op: "move", tableId, pawn: s.movable[s.movable.length - 1] });
    }
    const s = (await store.loadGame(tableId))!.state;
    expect(s.phase).toBe("over");
    expect(s.winners).toHaveLength(2);
    expect((s.winners![0]! % 2) === (s.winners![1]! % 2)).toBe(true);
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
