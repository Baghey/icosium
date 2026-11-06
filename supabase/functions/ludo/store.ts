import type { LudoOptions, LudoPublicView, LudoState } from "../_shared/ludo/index.ts";

export type TableStatus = "waiting" | "playing" | "finished";
/** Qui voit la table dans le lobby : tout le café, les amis des joueurs assis, ou personne (code seulement). */
export type Visibility = "public" | "friends" | "private";
export type TableRow = { id: string; code: string; hostId: string; options: LudoOptions; status: TableStatus };
/** Une chaise : un humain (userId) ou un bot (userId null, isBot true). */
export type SeatRow = { seat: number; userId: string | null; username: string; isBot?: boolean };

/** Vue publique enregistrée, avec l'heure du serveur pour caler les chronomètres des téléphones. */
export type StoredView = LudoPublicView & { sentAt: number };

/** Accès aux données. Supabase en production, mémoire dans les tests. */
export interface LudoStore {
  username(userId: string): Promise<string>;
  /** Nombre de tables (tous jeux) créées par cette personne depuis `since` (anti-spam). */
  countTablesSince(hostId: string, since: Date): Promise<number>;
  /** Ce code est-il déjà pris par une table d'un autre jeu ? (un code = une seule table) */
  codeUsedElsewhere(code: string): Promise<boolean>;
  /** Crée la table ; renvoie null si le code est déjà pris. */
  insertTable(row: Omit<TableRow, "id" | "status">, visibility: Visibility): Promise<TableRow | null>;
  tableByCode(code: string): Promise<TableRow | null>;
  tableById(id: string): Promise<TableRow | null>;
  seats(tableId: string): Promise<SeatRow[]>;
  /** Assoit quelqu'un ; false si la chaise vient d'être prise, "kicked" si le Patron l'a retiré de cette table. */
  insertSeat(tableId: string, seat: SeatRow): Promise<boolean | "kicked">;
  /** Le Patron a autorisé les bots à sa table. */
  allowBots(tableId: string): Promise<void>;
  loadGame(tableId: string): Promise<{ version: number; state: LudoState } | null>;
  /** Enregistre d'un coup l'état et la vue publique. False si quelqu'un a joué entre-temps. */
  commit(tableId: string, expectedVersion: number, state: LudoState, view: StoredView, status: TableStatus): Promise<boolean>;
}
