"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SeatInfo } from "./domino-client";
import { type GameId, isGameId } from "./games";
import { supabase } from "./supabase";

/** Qui voit la table dans le lobby. */
export type Visibility = "public" | "friends" | "private";
export const VISIBILITIES: Visibility[] = ["friends", "public", "private"];

/** Une table vue du lobby : jamais de main ni d'information de partie, seulement qui est assis. */
export type LobbyTable = {
  game: GameId;
  id: string;
  code: string;
  hostId: string;
  hostName: string;
  options: Record<string, unknown> & { players: number };
  status: "waiting" | "playing";
  visibility: Visibility;
  createdAt: string;
  seats: SeatInfo[];
  /** Je suis assis à cette table. */
  mine: boolean;
};

type Row = {
  game: string;
  id: string;
  code: string;
  host_id: string;
  host_name: string | null;
  options: Record<string, unknown>;
  status: "waiting" | "playing";
  visibility: Visibility;
  created_at: string;
  seats: { seat: number; userId: string | null; username: string; isBot: boolean | null }[];
  mine: boolean;
};

export async function fetchLobby(): Promise<LobbyTable[] | null> {
  const { data, error } = await supabase().rpc("lobby");
  if (error || !Array.isArray(data)) return null;
  return (data as Row[])
    .filter((r) => isGameId(r.game))
    .map((r) => ({
      game: r.game as GameId,
      id: r.id,
      code: r.code,
      hostId: r.host_id,
      hostName: r.host_name ?? "",
      options: { ...r.options, players: Number(r.options.players ?? 4) },
      status: r.status,
      visibility: r.visibility,
      createdAt: r.created_at,
      seats: (r.seats ?? []).map((s) => ({ seat: s.seat, userId: s.userId, username: s.username, isBot: Boolean(s.isBot) })),
      mine: r.mine,
    }));
}

/** Nombre de chaises encore libres. */
export const freeSeats = (t: Pick<LobbyTable, "options" | "seats">) => Math.max(0, t.options.players - t.seats.length);

/**
 * Le lobby en direct : relu toutes les 12 secondes tant que l'écran est visible, au retour
 * sur l'app et quand le réseau revient. Une coupure courte garde simplement la dernière liste.
 */
export function useLobby() {
  const [tables, setTables] = useState<LobbyTable[] | null>(null);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const res = await fetchLobby();
    busy.current = false;
    if (res) {
      setTables(res);
      setFailed(false);
    } else setFailed(true);
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => document.visibilityState === "visible" && void refresh(), 12_000);
    const onWake = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [refresh]);

  return { tables, failed, refresh };
}

/** Le Patron choisit qui voit sa table (avant la partie). */
export async function setTableVisibility(game: GameId, tableId: string, visibility: Visibility): Promise<boolean> {
  const { data, error } = await supabase().rpc("set_table_visibility", { p_game: game, p_table: tableId, p_visibility: visibility });
  return !error && data === true;
}

/** Le Patron retire quelqu'un (avant la partie) ; la personne ne peut plus revenir à cette table. */
export async function kickFromTable(game: GameId, tableId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase().rpc("kick_from_table", { p_game: game, p_table: tableId, p_user: userId });
  return !error && data === true;
}

/** Se lever de la table avant la partie. Pendant la partie, on garde sa chaise. */
export async function leaveTable(game: GameId, tableId: string): Promise<"left" | "closed" | "playing" | "not_seated" | "error"> {
  const { data, error } = await supabase().rpc("leave_table", { p_game: game, p_table: tableId });
  if (error) return "error";
  return data as "left" | "closed" | "playing" | "not_seated";
}

/** Lit la visibilité d'une table où je suis assis (la RLS laisse lire sa propre table). */
export async function fetchVisibility(game: GameId, tableId: string): Promise<Visibility | null> {
  const { data } = await supabase().from(`${game}_tables`).select("visibility").eq("id", tableId).maybeSingle();
  return (data?.visibility as Visibility | undefined) ?? null;
}
