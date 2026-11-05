"use client";

import type { DominoOptions, DominoPublicView, TileId } from "@icosium/shared";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type DominoView = DominoPublicView & { sentAt: number };
/** Une chaise : un humain (userId) ou un bot (userId null). */
export type SeatInfo = { seat: number; userId: string | null; username: string; isBot: boolean };
/** Clé stable d'une chaise (pour l'avatar) : l'id de la personne, ou « bot-<chaise> ». */
export const seatKey = (s: SeatInfo): string => s.userId ?? `bot-${s.seat}`;

export type TableInfo = { id: string; code: string; hostId: string; options: DominoOptions; status: "waiting" | "playing" | "finished" };

export type CallResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };

/** Appelle le serveur de domino (fonction Supabase « domino »). */
export async function callDomino(body: Record<string, unknown>): Promise<CallResult> {
  const { data, error } = await supabase().functions.invoke("domino", { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = (await error.context.json()) as { error?: string };
        return { ok: false, error: payload.error ?? "unknown" };
      } catch {
        return { ok: false, error: "unknown" };
      }
    }
    return { ok: false, error: "network" };
  }
  return { ok: true, data: (data ?? {}) as Record<string, unknown> };
}

export async function fetchTable(tableId: string): Promise<TableInfo | null> {
  const { data } = await supabase().from("domino_tables").select("id, code, host_id, options, status").eq("id", tableId).maybeSingle();
  if (!data) return null;
  return { id: data.id, code: data.code, hostId: data.host_id, options: data.options, status: data.status };
}

export async function fetchSeats(tableId: string): Promise<SeatInfo[]> {
  const { data } = await supabase().from("domino_seats").select("seat, user_id, username, is_bot").eq("table_id", tableId).order("seat");
  return (data ?? []).map((r) => ({
    seat: r.seat as number,
    userId: (r.user_id as string | null) ?? null,
    username: r.username as string,
    isBot: Boolean(r.is_bot),
  }));
}

export async function fetchView(tableId: string): Promise<{ version: number; view: DominoView } | null> {
  const { data } = await supabase().from("domino_states").select("version, view").eq("table_id", tableId).maybeSingle();
  return data ? { version: data.version as number, view: data.view as DominoView } : null;
}

/** Ma main : la base ne renvoie que la ligne de la personne connectée (règle RLS). */
export async function fetchMyHand(tableId: string, userId: string): Promise<{ version: number; tiles: TileId[] } | null> {
  const { data } = await supabase()
    .from("domino_hands")
    .select("version, tiles")
    .eq("table_id", tableId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ? { version: data.version as number, tiles: data.tiles as TileId[] } : null;
}
