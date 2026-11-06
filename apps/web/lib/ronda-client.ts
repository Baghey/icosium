"use client";

import type { RondaCard, RondaOptions, RondaPublicView } from "@icosium/shared";
import { FunctionsHttpError } from "@supabase/supabase-js";
import type { CallResult, SeatInfo } from "./domino-client";
import { supabase } from "./supabase";

export type RondaView = RondaPublicView & { sentAt: number };
export type RondaTableInfo = { id: string; code: string; hostId: string; options: RondaOptions; status: "waiting" | "playing" | "finished" };

/** Appelle le serveur de la Ronda (fonction Supabase « ronda »). */
export async function callRonda(body: Record<string, unknown>): Promise<CallResult> {
  const { data, error } = await supabase().functions.invoke("ronda", { body });
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

export async function fetchRondaTable(tableId: string): Promise<RondaTableInfo | null> {
  const { data } = await supabase().from("ronda_tables").select("id, code, host_id, options, status").eq("id", tableId).maybeSingle();
  if (!data) return null;
  return { id: data.id, code: data.code, hostId: data.host_id, options: data.options, status: data.status };
}

export async function fetchRondaSeats(tableId: string): Promise<SeatInfo[]> {
  const { data } = await supabase().from("ronda_seats").select("seat, user_id, username, is_bot").eq("table_id", tableId).order("seat");
  return (data ?? []).map((r) => ({
    seat: r.seat as number,
    userId: (r.user_id as string | null) ?? null,
    username: r.username as string,
    isBot: Boolean(r.is_bot),
  }));
}

export async function fetchRondaView(tableId: string): Promise<{ version: number; view: RondaView } | null> {
  const { data } = await supabase().from("ronda_states").select("version, view").eq("table_id", tableId).maybeSingle();
  return data ? { version: data.version as number, view: data.view as RondaView } : null;
}

/** Ma main, et seulement la mienne (la base refuse de donner celle des autres). */
export async function fetchRondaHand(tableId: string, userId: string): Promise<{ version: number; cards: RondaCard[] } | null> {
  const { data } = await supabase().from("ronda_hands").select("version, cards").eq("table_id", tableId).eq("user_id", userId).maybeSingle();
  return data ? { version: data.version as number, cards: data.cards as RondaCard[] } : null;
}
