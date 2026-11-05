import type { DominoOptions, DominoPublicView, DominoState } from "../_shared/domino/index.ts";

export type TableStatus = "waiting" | "playing" | "finished";
export type TableRow = { id: string; code: string; hostId: string; options: DominoOptions; status: TableStatus };
export type SeatRow = { seat: number; userId: string; username: string };

/** Vue publique enregistrée, avec l'heure du serveur pour caler les chronomètres des téléphones. */
export type StoredView = DominoPublicView & { sentAt: number };

/** Accès aux données. Supabase en production, mémoire dans les tests. */
export interface DominoStore {
  username(userId: string): Promise<string>;
  /** Nombre de tables créées par cette personne depuis `since` (anti-spam). */
  countTablesSince(hostId: string, since: Date): Promise<number>;
  /** Crée la table ; renvoie null si le code est déjà pris. */
  insertTable(row: Omit<TableRow, "id" | "status">): Promise<TableRow | null>;
  tableByCode(code: string): Promise<TableRow | null>;
  tableById(id: string): Promise<TableRow | null>;
  seats(tableId: string): Promise<SeatRow[]>;
  /** Assoit quelqu'un ; renvoie false si la chaise vient d'être prise. */
  insertSeat(tableId: string, seat: SeatRow): Promise<boolean>;
  setStatus(tableId: string, status: TableStatus): Promise<void>;
  loadGame(tableId: string): Promise<{ version: number; state: DominoState } | null>;
  /** Enregistre d'un coup l'état, la vue publique et les mains. False si quelqu'un a joué entre-temps. */
  commit(
    tableId: string,
    expectedVersion: number,
    state: DominoState,
    view: StoredView,
    hands: Record<string, string[]>,
    status: TableStatus,
  ): Promise<boolean>;
}
