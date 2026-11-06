import type { DominoState } from "../_shared/domino/index.ts";
import type { DominoStore, SeatRow, Visibility, StoredView, TableRow, TableStatus } from "./store.ts";

/** Stockage en mémoire pour les tests : se comporte comme les tables Supabase. */
export class MemoryStore implements DominoStore {
  tables = new Map<string, TableRow & { createdAt: number; visibility: Visibility; kicked: string[] }>();
  seatRows = new Map<string, SeatRow[]>();
  games = new Map<string, { version: number; state: DominoState }>();
  views = new Map<string, { version: number; view: StoredView }>();
  hands = new Map<string, Record<string, string[]>>();
  names = new Map<string, string>();
  private seq = 0;

  constructor(private now: () => number) {}

  async username(userId: string) {
    return this.names.get(userId) ?? `player_${userId}`;
  }
  async countTablesSince(hostId: string, since: Date) {
    return [...this.tables.values()].filter((t) => t.hostId === hostId && t.createdAt >= since.getTime()).length;
  }
  async insertTable(row: Omit<TableRow, "id" | "status">, visibility: Visibility) {
    if ([...this.tables.values()].some((t) => t.code === row.code)) return null;
    const table = { ...row, id: `t${++this.seq}`, status: "waiting" as TableStatus, createdAt: this.now(), visibility, kicked: [] as string[] };
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
    if (seat.userId && this.tables.get(tableId)?.kicked.includes(seat.userId)) return "kicked" as const;
    const rows = this.seatRows.get(tableId) ?? [];
    if (rows.some((r) => r.seat === seat.seat || (seat.userId !== null && r.userId === seat.userId))) return false;
    rows.push(seat);
    this.seatRows.set(tableId, rows);
    return true;
  }
  async setStatus(tableId: string, status: TableStatus) {
    const t = this.tables.get(tableId);
    if (t) t.status = status;
  }
  async allowBots(tableId: string) {
    const t = this.tables.get(tableId);
    if (t) t.options = { ...t.options, botAllowed: true };
  }
  async loadGame(tableId: string) {
    const g = this.games.get(tableId);
    return g ? { version: g.version, state: structuredClone(g.state) } : null;
  }
  async commit(tableId: string, expected: number, state: DominoState, view: StoredView, hands: Record<string, string[]>, status: TableStatus) {
    const current = this.games.get(tableId)?.version ?? 0;
    if (current !== expected) return false;
    this.games.set(tableId, { version: expected + 1, state: structuredClone(state) });
    this.views.set(tableId, { version: expected + 1, view: structuredClone(view) });
    this.hands.set(tableId, structuredClone(hands));
    await this.setStatus(tableId, status);
    return true;
  }
}
