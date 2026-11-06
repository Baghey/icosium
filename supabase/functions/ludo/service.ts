/**
 * Le serveur du Ludo : il reçoit les demandes des joueurs, vérifie tout, tire le dé lui-même,
 * applique les règles (packages/shared/src/ludo) et enregistre le résultat. Le client ne choisit
 * jamais le chiffre du dé et ne décide de rien.
 */
import {
  type LudoRng,
  type LudoState,
  applyLudoAction,
  applyLudoTimeout,
  createLudoGame,
  ludoPublicView,
  parseLudoOptions,
} from "../_shared/ludo/index.ts";
import type { LudoStore, SeatRow, StoredView, TableRow, TableStatus } from "./store.ts";

export type ServiceResult = { status: number; body: Record<string, unknown> };

const ok = (body: Record<string, unknown> = {}): ServiceResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, error: string): ServiceResult => ({ status, body: { ok: false, error } });

/** Anti-spam : au plus 5 tables créées par personne toutes les 10 minutes (tous jeux confondus). */
export const TABLE_CREATE_LIMIT = 5;
export const TABLE_CREATE_WINDOW_MS = 10 * 60_000;

/** Lettres des codes de table (sans I ni O, faciles à confondre avec 1 et 0). */
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function makeCode(rng: LudoRng): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(rng() * CODE_LETTERS.length)];
  return code;
}

export function normalizeCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.trim().toUpperCase();
  return /^[A-Z]{4}$/.test(code) ? code : null;
}

export type Deps = { store: LudoStore; rng: LudoRng; now: () => number };

const statusOf = (state: LudoState): TableStatus => (state.phase === "over" ? "finished" : "playing");

/** Noms des bots : des habitués du café (les mêmes qu'au domino). */
export const BOT_NAMES = ["Ammi Rachid", "Khalti Nouria", "Kader", "Djamel", "Hadj Saïd", "Lynda", "Mourad", "Yasmina"];

async function save(deps: Deps, table: TableRow, expected: number, state: LudoState): Promise<boolean> {
  const view: StoredView = { ...ludoPublicView(state), sentAt: deps.now() };
  return deps.store.commit(table.id, expected, state, view, statusOf(state));
}

async function startGame(deps: Deps, table: TableRow, seats: SeatRow[]): Promise<void> {
  const bots = seats.filter((s) => s.isBot).map((s) => s.seat);
  await save(deps, table, 0, createLudoGame(table.options, deps.rng, deps.now(), bots));
}

/** Assoit des bots sur toutes les chaises libres, puis lance la partie. */
async function fillWithBots(deps: Deps, table: TableRow): Promise<void> {
  const players = table.options.players;
  let seats = await deps.store.seats(table.id);
  const names = BOT_NAMES.filter((n) => !seats.some((s) => s.username === n));
  for (let seat = 0; seat < players; seat++) {
    if (seats.some((s) => s.seat === seat)) continue;
    const [name] = names.splice(Math.floor(deps.rng() * names.length), 1);
    await deps.store.insertSeat(table.id, { seat, userId: null, username: name ?? `Bot ${seat + 1}`, isBot: true });
  }
  seats = await deps.store.seats(table.id);
  if (seats.length === players) await startGame(deps, table, seats);
}

/**
 * Crée une table avec les réglages du Patron. `solo` : il joue seul, les autres chaises sont
 * données à des bots (c'est lui qui le demande, donc les bots sont autorisés).
 */
export async function createTable(deps: Deps, userId: string, rawOptions: unknown, solo = false): Promise<ServiceResult> {
  const since = new Date(deps.now() - TABLE_CREATE_WINDOW_MS);
  if ((await deps.store.countTablesSince(userId, since)) >= TABLE_CREATE_LIMIT) return fail(429, "rate_limited");
  const options = { ...parseLudoOptions(rawOptions), ...(solo ? { botAllowed: true } : {}) };
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode(deps.rng);
    if (await deps.store.codeUsedElsewhere(code)) continue;
    const table = await deps.store.insertTable({ code, hostId: userId, options });
    if (!table) continue;
    const username = await deps.store.username(userId);
    await deps.store.insertSeat(table.id, { seat: 0, userId, username });
    if (solo) await fillWithBots(deps, table);
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
  if (seats.length === players) await startGame(deps, table, seats);
  return ok({ code, tableId: table.id });
}

/** Le Patron, dans la salle d'attente, donne les chaises libres à des bots. Lui seul peut le faire. */
export async function addBots(deps: Deps, userId: string, input: { tableId?: unknown }): Promise<ServiceResult> {
  if (typeof input.tableId !== "string") return fail(400, "invalid_table");
  const table = await deps.store.tableById(input.tableId);
  if (!table) return fail(404, "table_not_found");
  if (table.hostId !== userId) return fail(403, "not_host");
  if (table.status !== "waiting") return fail(409, "table_started");
  await deps.store.allowBots(table.id);
  await fillWithBots(deps, { ...table, options: { ...table.options, botAllowed: true } });
  return ok();
}

type Loaded = { table: TableRow; mySeat: number; version: number; state: LudoState };

async function loadForMember(deps: Deps, userId: string, tableId: unknown): Promise<Loaded | ServiceResult> {
  if (typeof tableId !== "string") return fail(400, "invalid_table");
  const table = await deps.store.tableById(tableId);
  if (!table) return fail(404, "table_not_found");
  const mine = (await deps.store.seats(table.id)).find((s) => s.userId === userId);
  if (!mine) return fail(403, "not_seated");
  const game = await deps.store.loadGame(table.id);
  if (!game) return fail(409, "not_started");
  return { table, mySeat: mine.seat, version: game.version, state: game.state };
}

/** Lancer le dé : le chiffre est tiré ici, jamais par le téléphone. */
export async function roll(deps: Deps, userId: string, input: { tableId?: unknown }): Promise<ServiceResult> {
  const loaded = await loadForMember(deps, userId, input.tableId);
  if ("status" in loaded) return loaded;
  const result = applyLudoAction(loaded.state, loaded.mySeat, { type: "roll" }, deps.rng, deps.now());
  if (!result.ok) return fail(409, result.error);
  if (!(await save(deps, loaded.table, loaded.version, result.state))) return fail(409, "conflict");
  return ok({ die: result.state.die });
}

/** Bouger un pion (le serveur vérifie qu'il peut bouger avec le dé tiré). */
export async function move(deps: Deps, userId: string, input: { tableId?: unknown; pawn?: unknown }): Promise<ServiceResult> {
  const loaded = await loadForMember(deps, userId, input.tableId);
  if ("status" in loaded) return loaded;
  if (typeof input.pawn !== "number" || !Number.isInteger(input.pawn)) return fail(400, "invalid_move");
  const result = applyLudoAction(loaded.state, loaded.mySeat, { type: "move", pawn: input.pawn }, deps.rng, deps.now());
  if (!result.ok) return fail(409, result.error);
  if (!(await save(deps, loaded.table, loaded.version, result.state))) return fail(409, "conflict");
  return ok();
}

/**
 * Le chrono est fini (ou c'est à un bot) : n'importe quel joueur de la table peut le signaler, le
 * serveur vérifie l'heure lui-même, puis joue à la place du joueur en retard.
 */
export async function tick(deps: Deps, userId: string, input: { tableId?: unknown }): Promise<ServiceResult> {
  const loaded = await loadForMember(deps, userId, input.tableId);
  if ("status" in loaded) return loaded;
  const result = applyLudoTimeout(loaded.state, deps.rng, deps.now());
  if (!result.ok) return ok({ changed: false });
  if (!(await save(deps, loaded.table, loaded.version, result.state))) return ok({ changed: false });
  return ok({ changed: true });
}

/** Point d'entrée unique : { op: "create" | "join" | "bots" | "roll" | "move" | "tick", ... }. */
export async function handle(deps: Deps, userId: string, body: Record<string, unknown>): Promise<ServiceResult> {
  switch (body.op) {
    case "create":
      return createTable(deps, userId, body.options, body.solo === true);
    case "join":
      return joinTable(deps, userId, body.code);
    case "bots":
      return addBots(deps, userId, body);
    case "roll":
      return roll(deps, userId, body);
    case "move":
      return move(deps, userId, body);
    case "tick":
      return tick(deps, userId, body);
    default:
      return fail(400, "unknown_op");
  }
}
