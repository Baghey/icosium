/**
 * Le serveur de domino : il reçoit les demandes des joueurs, vérifie tout, applique les règles
 * (packages/shared/src/domino) et enregistre le résultat. Le client ne décide jamais de rien.
 */
import {
  type DominoState,
  type End,
  type Rng,
  applyDominoAction,
  applyTimeout,
  createDominoGame,
  isValidTileId,
  parseDominoOptions,
  publicView,
  startNextRound,
} from "../_shared/domino/index.ts";
import type { DominoStore, SeatRow, StoredView, TableRow, TableStatus } from "./store.ts";

export type ServiceResult = { status: number; body: Record<string, unknown> };

const ok = (body: Record<string, unknown> = {}): ServiceResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, error: string): ServiceResult => ({ status, body: { ok: false, error } });

/** Anti-spam : au plus 5 tables créées par personne toutes les 10 minutes. */
export const TABLE_CREATE_LIMIT = 5;
export const TABLE_CREATE_WINDOW_MS = 10 * 60_000;

/** Lettres des codes de table (sans I ni O, faciles à confondre avec 1 et 0). */
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function makeCode(rng: Rng): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(rng() * CODE_LETTERS.length)];
  return code;
}

export function normalizeCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.trim().toUpperCase();
  return /^[A-Z]{4}$/.test(code) ? code : null;
}

export type Deps = { store: DominoStore; rng: Rng; now: () => number };

function statusOf(state: DominoState): TableStatus {
  return state.phase === "gameOver" ? "finished" : "playing";
}

function handsByUser(state: DominoState, seats: SeatRow[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const s of seats) out[s.userId] = [...(state.hands[s.seat] ?? [])];
  return out;
}

async function save(deps: Deps, table: TableRow, seats: SeatRow[], expected: number, state: DominoState): Promise<boolean> {
  const view: StoredView = { ...publicView(state), sentAt: deps.now() };
  return deps.store.commit(table.id, expected, state, view, handsByUser(state, seats), statusOf(state));
}

/** Crée une table avec les réglages du Patron. */
export async function createTable(deps: Deps, userId: string, rawOptions: unknown): Promise<ServiceResult> {
  const since = new Date(deps.now() - TABLE_CREATE_WINDOW_MS);
  if ((await deps.store.countTablesSince(userId, since)) >= TABLE_CREATE_LIMIT) return fail(429, "rate_limited");
  const options = parseDominoOptions(rawOptions);
  for (let attempt = 0; attempt < 8; attempt++) {
    const table = await deps.store.insertTable({ code: makeCode(deps.rng), hostId: userId, options });
    if (!table) continue;
    const username = await deps.store.username(userId);
    await deps.store.insertSeat(table.id, { seat: 0, userId, username });
    return ok({ code: table.code, tableId: table.id });
  }
  return fail(503, "no_code_available");
}

/** Entre à une table par son code. La partie démarre seule quand toutes les chaises sont prises. */
export async function joinTable(deps: Deps, userId: string, rawCode: unknown): Promise<ServiceResult> {
  const code = normalizeCode(rawCode);
  if (!code) return fail(400, "invalid_code");
  const table = await deps.store.tableByCode(code);
  if (!table) return fail(404, "table_not_found");

  let seats = await deps.store.seats(table.id);
  if (seats.some((s) => s.userId === userId)) return ok({ code, tableId: table.id }); // déjà assis : on revient
  if (table.status !== "waiting") return fail(409, "table_started");

  const players = table.options.players;
  const free = Array.from({ length: players }, (_, i) => i).find((i) => !seats.some((s) => s.seat === i));
  if (free === undefined) return fail(409, "table_full");
  const username = await deps.store.username(userId);
  if (!(await deps.store.insertSeat(table.id, { seat: free, userId, username }))) return fail(409, "seat_taken");

  seats = await deps.store.seats(table.id);
  if (seats.length === players) {
    // Toutes les chaises sont prises par des humains : la partie commence.
    const state = createDominoGame(table.options, deps.rng, deps.now());
    await save(deps, table, seats, 0, state);
  }
  return ok({ code, tableId: table.id });
}

type Loaded = { table: TableRow; seats: SeatRow[]; mySeat: number; version: number; state: DominoState };

async function loadForMember(deps: Deps, userId: string, tableId: unknown): Promise<Loaded | ServiceResult> {
  if (typeof tableId !== "string") return fail(400, "invalid_table");
  const table = await deps.store.tableById(tableId);
  if (!table) return fail(404, "table_not_found");
  const seats = await deps.store.seats(table.id);
  const mine = seats.find((s) => s.userId === userId);
  if (!mine) return fail(403, "not_seated");
  const game = await deps.store.loadGame(table.id);
  if (!game) return fail(409, "not_started");
  return { table, seats, mySeat: mine.seat, version: game.version, state: game.state };
}

/** Un joueur pose un domino. */
export async function playTile(deps: Deps, userId: string, input: { tableId?: unknown; tile?: unknown; end?: unknown }): Promise<ServiceResult> {
  const loaded = await loadForMember(deps, userId, input.tableId);
  if ("status" in loaded) return loaded;
  if (!isValidTileId(input.tile) || (input.end !== "left" && input.end !== "right")) return fail(400, "invalid_move");
  const result = applyDominoAction(loaded.state, loaded.mySeat, { type: "play", tile: input.tile, end: input.end as End }, deps.now());
  if (!result.ok) return fail(409, result.error);
  if (!(await save(deps, loaded.table, loaded.seats, loaded.version, result.state))) return fail(409, "conflict");
  return ok();
}

/**
 * Le chronomètre est fini : n'importe quel joueur de la table peut le signaler, le serveur vérifie
 * l'heure lui-même, puis joue à la place du joueur en retard (ou lance la manche suivante).
 */
export async function tick(deps: Deps, userId: string, input: { tableId?: unknown }): Promise<ServiceResult> {
  const loaded = await loadForMember(deps, userId, input.tableId);
  if ("status" in loaded) return loaded;
  const result = applyTimeout(loaded.state, deps.rng, deps.now());
  if (!result.ok) return ok({ changed: false });
  if (!(await save(deps, loaded.table, loaded.seats, loaded.version, result.state))) return ok({ changed: false });
  return ok({ changed: true });
}

/** Un joueur ne veut pas attendre la fin de la pause : la manche suivante commence. */
export async function nextRound(deps: Deps, userId: string, input: { tableId?: unknown }): Promise<ServiceResult> {
  const loaded = await loadForMember(deps, userId, input.tableId);
  if ("status" in loaded) return loaded;
  const result = startNextRound(loaded.state, deps.rng, deps.now());
  if (!result.ok) return fail(409, result.error);
  if (!(await save(deps, loaded.table, loaded.seats, loaded.version, result.state))) return fail(409, "conflict");
  return ok();
}

/** Point d'entrée unique : { op: "create" | "join" | "play" | "tick" | "next", ... }. */
export async function handle(deps: Deps, userId: string, body: Record<string, unknown>): Promise<ServiceResult> {
  switch (body.op) {
    case "create":
      return createTable(deps, userId, body.options);
    case "join":
      return joinTable(deps, userId, body.code);
    case "play":
      return playTile(deps, userId, body);
    case "tick":
      return tick(deps, userId, body);
    case "next":
      return nextRound(deps, userId, body);
    default:
      return fail(400, "unknown_op");
  }
}
