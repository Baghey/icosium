import type { LudoState } from "../_shared/ludo/index.ts";
import type { LudoStore, SeatRow, StoredView, TableRow, TableStatus } from "./store.ts";

/** Stockage en mémoire pour les tests : se comporte comme les tables Supabase. */
export class MemoryStore implements LudoStore {
  tables = new Map<string, TableRow & { createdAt: number }>();
  seatRows = new Map<string, SeatRow[]>();
  games = new Map<string, { version: number; state: LudoState }>();
  views = new Map<string, { version: number; view: StoredView }>();
  names = new Map<string, string>();
  otherCodes = new Set<string>();
  otherTables = 0;
  private seq = 0;

  constructor(private now: () => number) {}

  async username(userId: string) {
    return this.names.get(userId) ?? `player_${userId}`;
  }
  async countTablesSince(hostId: string, since: Date) {
    return this.otherTables + [...this.tables.values()].filter((t) => t.hostId === hostId && t.createdAt >= since.getTime()).length;
  }
  async codeUsedElsewhere(code: string) {
    return this.otherCodes.has(code);
  }
  async insertTable(row: Omit<TableRow, "id" | "status">) {
    if ([...this.tables.values()].some((t) => t.code === row.code)) return null;
    const table = { ...row, id: `t${++this.seq}`, status: "waiting" as TableStatus, createdAt: this.now() };
    this.tables.set(table.id, table);
    this.seatRows.set(table.id, []);
    return table;
  }
  async tableByCode(code: string) {
    return [...this.tables.values()].find((t) => t.code === code) ?? null;
  }
  async tableById(id: string) {
    return this.tables.get(id) ?? null;
  }
  async seats(tableId: string) {
    return [...(this.seatRows.get(tableId) ?? [])].sort((a, b) => a.seat - b.seat);
  }
  async insertSeat(tableId: string, seat: SeatRow) {
    const rows = this.seatRows.get(tableId) ?? [];
    if (rows.some((r) => r.seat === seat.seat || (seat.userId !== null && r.userId === seat.userId))) return false;
    rows.push(seat);
    this.seatRows.set(tableId, rows);
    return true;
  }
  async allowBots(tableId: string) {
    const t = this.tables.get(tableId);
    if (t) t.options = { ...t.options, botAllowed: true };
  }
  async loadGame(tableId: string) {
    const g = this.games.get(tableId);
    return g ? { version: g.version, state: structuredClone(g.state) } : null;
  }
  async commit(tableId: string, expected: number, state: LudoState, view: StoredView, status: TableStatus) {
    const current = this.games.get(tableId)?.version ?? 0;
    if (current !== expected) return false;
    this.games.set(tableId, { version: expected + 1, state: structuredClone(state) });
    this.views.set(tableId, { version: expected + 1, view: structuredClone(view) });
    const t = this.tables.get(tableId);
    if (t) t.status = status;
    return true;
  }
}
