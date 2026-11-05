import { describe, expect, it } from "vitest";
import { seededRng } from "../_shared/domino/index.ts";
import { MemoryStore } from "./memory-store.ts";
import { type Deps, TABLE_CREATE_LIMIT, handle } from "./service.ts";

function setup() {
  let now = 1_000_000;
  const clock = { now: () => now, advance: (ms: number) => (now += ms) };
  const store = new MemoryStore(clock.now);
  const deps: Deps = { store, rng: seededRng(42), now: clock.now };
  return { store, deps, clock };
}

async function fullTable(players: 2 | 4 = 4) {
  const env = setup();
  const created = await handle(env.deps, "u0", { op: "create", options: { players } });
  const code = created.body.code as string;
  const tableId = created.body.tableId as string;
  for (let i = 1; i < players; i++) await handle(env.deps, `u${i}`, { op: "join", code });
  return { ...env, code, tableId };
}

describe("créer et rejoindre une table", () => {
  it("crée une table avec un code de 4 lettres et assoit le Patron", async () => {
    const { deps, store } = setup();
    const r = await handle(deps, "u0", { op: "create", options: { players: 4, targetScore: 51 } });
    expect(r.status).toBe(200);
    expect(r.body.code).toMatch(/^[A-HJ-NP-Z]{4}$/);
    const seats = await store.seats(r.body.tableId as string);
    expect(seats).toEqual([{ seat: 0, userId: "u0", username: "player_u0" }]);
    expect((await store.tableById(r.body.tableId as string))?.options.targetScore).toBe(51);
  });
  it("accepte le code en minuscules", async () => {
    const { deps } = setup();
    const r = await handle(deps, "u0", { op: "create", options: {} });
    const j = await handle(deps, "u1", { op: "join", code: (r.body.code as string).toLowerCase() });
    expect(j.status).toBe(200);
  });
  it("refuse un code inconnu ou mal écrit", async () => {
    const { deps } = setup();
    expect((await handle(deps, "u1", { op: "join", code: "ZZZZ" })).body.error).toBe("table_not_found");
    expect((await handle(deps, "u1", { op: "join", code: "12" })).body.error).toBe("invalid_code");
  });
  it("limite la création de tables (anti-spam)", async () => {
    const { deps } = setup();
    for (let i = 0; i < TABLE_CREATE_LIMIT; i++) expect((await handle(deps, "u0", { op: "create" })).status).toBe(200);
    expect((await handle(deps, "u0", { op: "create" })).body.error).toBe("rate_limited");
  });
  it("ne démarre pas tant que toutes les chaises ne sont pas prises par des humains", async () => {
    const { deps, store } = setup();
    const r = await handle(deps, "u0", { op: "create", options: { players: 4 } });
    await handle(deps, "u1", { op: "join", code: r.body.code });
    await handle(deps, "u2", { op: "join", code: r.body.code });
    expect(await store.loadGame(r.body.tableId as string)).toBeNull();
    await handle(deps, "u3", { op: "join", code: r.body.code });
    expect(await store.loadGame(r.body.tableId as string)).not.toBeNull();
    expect((await store.tableById(r.body.tableId as string))?.status).toBe("playing");
  });
  it("refuse une 5e personne, mais laisse revenir un joueur déjà assis", async () => {
    const { deps, code } = await fullTable(4);
    expect((await handle(deps, "u9", { op: "join", code })).body.error).toBe("table_started");
    expect((await handle(deps, "u2", { op: "join", code })).status).toBe(200);
  });
});

describe("jouer", () => {
  it("chaque joueur ne reçoit que sa main ; la vue publique n'en montre que le nombre", async () => {
    const { store, tableId } = await fullTable(2);
    const view = store.views.get(tableId)?.view;
    const game = (await store.loadGame(tableId))?.state;
    if (!view || !game) throw new Error("pas de partie");
    expect(view.handCounts).toEqual([7, 7]);
    expect(view.boneyardCount).toBe(14);
    const json = JSON.stringify(view);
    for (const t of [...game.hands.flat(), ...game.boneyard].filter((t) => t !== game.mustOpenWith)) {
      expect(json).not.toContain(`"${t}"`);
    }
    expect(store.hands.get(tableId)).toEqual({ u0: game.hands[0], u1: game.hands[1] });
  });
  it("refuse un coup hors de son tour et un coup d'un non-joueur", async () => {
    const { deps, store, tableId } = await fullTable(4);
    const game = (await store.loadGame(tableId))?.state;
    if (!game) throw new Error("pas de partie");
    const other = `u${(game.turn + 1) % 4}`;
    const tile = game.hands[(game.turn + 1) % 4]?.[0];
    expect((await handle(deps, other, { op: "play", tableId, tile, end: "right" })).body.error).toBe("not_your_turn");
    expect((await handle(deps, "intrus", { op: "play", tableId, tile, end: "right" })).body.error).toBe("not_seated");
  });
  it("accepte le bon coup et fait avancer la version", async () => {
    const { deps, store, tableId } = await fullTable(4);
    const game = (await store.loadGame(tableId))?.state;
    if (!game) throw new Error("pas de partie");
    const r = await handle(deps, `u${game.turn}`, { op: "play", tableId, tile: game.mustOpenWith, end: "right" });
    expect(r.status).toBe(200);
    expect(store.views.get(tableId)?.version).toBe(2);
    expect(store.views.get(tableId)?.view.chain).toHaveLength(1);
  });
  it("le chrono ne peut pas être déclenché en avance", async () => {
    const { deps, tableId, clock, store } = await fullTable(4);
    expect((await handle(deps, "u1", { op: "tick", tableId })).body.changed).toBe(false);
    clock.advance(30_000);
    expect((await handle(deps, "u1", { op: "tick", tableId })).body.changed).toBe(true);
    expect(store.views.get(tableId)?.view.chain).toHaveLength(1);
  });
  it("une partie complète à 4 se joue jusqu'au bout via le serveur", async () => {
    const { deps, tableId, clock, store } = await fullTable(4);
    for (let i = 0; i < 3000; i++) {
      const game = (await store.loadGame(tableId))?.state;
      if (!game || game.phase === "gameOver") break;
      if (game.phase === "roundOver") {
        await handle(deps, "u0", { op: "next", tableId });
        continue;
      }
      clock.advance(31_000);
      await handle(deps, `u${i % 4}`, { op: "tick", tableId });
    }
    expect((await store.tableById(tableId))?.status).toBe("finished");
    const view = store.views.get(tableId)?.view;
    expect(view?.phase).toBe("gameOver");
    expect(Math.max(...(view?.scores ?? [0]))).toBeGreaterThanOrEqual(101);
  });
});
