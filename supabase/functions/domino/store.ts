import type { DominoOptions, DominoPublicView, DominoState } from "../_shared/domino/index.ts";

export type TableStatus = "waiting" | "playing" | "finished";
/** Qui voit la table dans le lobby : tout le café, les amis des joueurs assis, ou personne (code seulement). */
export type Visibility = "public" | "friends" | "private";
export type TableRow = { id: string; code: string; hostId: string; options: DominoOptions; status: TableStatus };
/** Une chaise : un humain (userId) ou un bot (userId null, isBot true). */
export type SeatRow = { seat: number; userId: string | null; username: string; isBot?: boolean };

/** Vue publique enregistrée, avec l'heure du serveur pour caler les chronomètres des téléphones. */
export type StoredView = DominoPublicView & { sentAt: number };

/** Accès aux données. Supabase en production, mémoire dans les tests. */
export interface DominoStore {
  username(userId: string): Promise<string>;
  /** Nombre de tables créées par cette personne depuis `since` (anti-spam). */
  countTablesSince(hostId: string, since: Date): Promise<number>;
  /** Crée la table ; renvoie null si le code est déjà pris. */
  insertTable(row: Omit<TableRow, "id" | "status">, visibility: Visibility): Promise<TableRow | null>;
  tableByCode(code: string): Promise<TableRow | null>;
  tableById(id: string): Promise<TableRow | null>;
  seats(tableId: string): Promise<SeatRow[]>;
  /** Assoit quelqu'un ; false si la chaise vient d'être prise, "kicked" si le Patron l'a retiré de cette table. */
  insertSeat(tableId: string, seat: SeatRow): Promise<boolean | "kicked">;
  setStatus(tableId: string, status: TableStatus): Promise<void>;
  /** Le Patron a autorisé les bots à sa table. */
  allowBots(tableId: string): Promise<void>;
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
