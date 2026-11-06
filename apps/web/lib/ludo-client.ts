"use client";

import type { LudoOptions, LudoPublicView } from "@icosium/shared";
import { FunctionsHttpError } from "@supabase/supabase-js";
import type { CallResult, SeatInfo } from "./domino-client";
import { supabase } from "./supabase";

export type LudoView = LudoPublicView & { sentAt: number };
export type LudoTableInfo = { id: string; code: string; hostId: string; options: LudoOptions; status: "waiting" | "playing" | "finished" };

/** Appelle le serveur du Ludo (fonction Supabase « ludo »). */
export async function callLudo(body: Record<string, unknown>): Promise<CallResult> {
  const { data, error } = await supabase().functions.invoke("ludo", { body });
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

export async function fetchLudoTable(tableId: string): Promise<LudoTableInfo | null> {
  const { data } = await supabase().from("ludo_tables").select("id, code, host_id, options, status").eq("id", tableId).maybeSingle();
  if (!data) return null;
  return { id: data.id, code: data.code, hostId: data.host_id, options: data.options, status: data.status };
}

export async function fetchLudoSeats(tableId: string): Promise<SeatInfo[]> {
  const { data } = await supabase().from("ludo_seats").select("seat, user_id, username, is_bot").eq("table_id", tableId).order("seat");
  return (data ?? []).map((r) => ({
    seat: r.seat as number,
    userId: (r.user_id as string | null) ?? null,
    username: r.username as string,
    isBot: Boolean(r.is_bot),
  }));
}

export async function fetchLudoView(tableId: string): Promise<{ version: number; view: LudoView } | null> {
  const { data } = await supabase().from("ludo_states").select("version, view").eq("table_id", tableId).maybeSingle();
  return data ? { version: data.version as number, view: data.view as LudoView } : null;
}
