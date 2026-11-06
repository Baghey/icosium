"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-context";
import type { CallResult, SeatInfo } from "./domino-client";
import type { RondaAnnounce, RondaCard } from "@icosium/shared";
import { type RondaTableInfo, type RondaView, callRonda, fetchRondaHand, fetchRondaSeats, fetchRondaTable, fetchRondaView } from "./ronda-client";
import { supabase } from "./supabase";

export type RondaTableState = {
  loading: boolean;
  joinError: string | null;
  table: RondaTableInfo | null;
  seats: SeatInfo[];
  view: RondaView | null;
  version: number;
  /** Ma main (lue à part : personne d'autre ne la reçoit). */
  hand: RondaCard[];
  handVersion: number;
  /** Décalage entre l'horloge du serveur et celle du téléphone (ms). */
  clockOffset: number;
};

function sampleOffset(ref: { current: number | null }, sentAt: number): number {
  const s = sentAt - Date.now();
  ref.current = ref.current === null ? s : Math.max(ref.current, s);
  return ref.current;
}

/**
 * Tout ce qu'il faut pour une table de Ronda : on s'assoit (ou on revient à sa place), puis on suit
 * la partie et sa propre main en temps réel. Si le temps réel décroche (réseau faible), on relit la table régulièrement.
 */
export function useRondaTable(code: string) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<RondaTableState>({
    loading: true,
    joinError: null,
    table: null,
    seats: [],
    view: null,
    version: 0,
    hand: [],
    handVersion: 0,
    clockOffset: 0,
  });
  const versionRef = useRef(0);
  const offsetRef = useRef<number | null>(null);
  const tableIdRef = useRef<string | null>(null);

  const accept = useCallback((v: { version: number; view: RondaView } | null) => {
    if (!v || v.version < versionRef.current) return;
    versionRef.current = v.version;
    setState((s) => ({ ...s, view: v.view, version: v.version, clockOffset: sampleOffset(offsetRef, v.view.sentAt) }));
  }, []);

  const handVersionRef = useRef(0);
  const acceptHand = useCallback((h: { version: number; cards: RondaCard[] } | null) => {
    if (!h || h.version < handVersionRef.current) return;
    handVersionRef.current = h.version;
    setState((s) => ({ ...s, hand: h.cards, handVersion: h.version }));
  }, []);

  const refreshView = useCallback(async () => {
    const tableId = tableIdRef.current;
    if (!tableId) return;
    const [view, hand] = await Promise.all([fetchRondaView(tableId), userId ? fetchRondaHand(tableId, userId) : null]);
    accept(view);
    acceptHand(hand);
  }, [accept, acceptHand, userId]);

  const refreshSeats = useCallback(async () => {
    const tableId = tableIdRef.current;
    if (!tableId) return;
    const [seats, table] = await Promise.all([fetchRondaSeats(tableId), fetchRondaTable(tableId)]);
    setState((s) => ({ ...s, seats, table: table ?? s.table }));
  }, []);

  // 1. S'asseoir à la table (ou retrouver sa place après un rechargement ou une coupure).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      let res = await callRonda({ op: "join", code });
      // Réseau coupé au chargement : on réessaie doucement, sans afficher d'erreur.
      for (let i = 0; !res.ok && res.error === "network" && i < 5 && !cancelled; i++) {
        await new Promise((r) => window.setTimeout(r, 1500 * (i + 1)));
        res = await callRonda({ op: "join", code });
      }
      if (cancelled) return;
      if (!res.ok) {
        setState((s) => ({ ...s, loading: false, joinError: res.error }));
        return;
      }
      tableIdRef.current = res.data.tableId as string;
      await Promise.all([refreshSeats(), refreshView()]);
      if (!cancelled) setState((s) => ({ ...s, loading: false }));
    })();
    return () => {
      cancelled = true;
    };
  }, [code, userId, refreshSeats, refreshView]);

  // 2. Suivre la table en temps réel.
  useEffect(() => {
    const tableId = state.table?.id;
    if (!tableId || !userId) return;
    const filter = `table_id=eq.${tableId}`;
    const channel = supabase()
      .channel(`ronda:${tableId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ronda_states", filter }, (payload) => {
        const row = payload.new as { version?: number; view?: RondaView };
        if (row.view && typeof row.version === "number") accept({ version: row.version, view: row.view });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ronda_hands", filter }, (payload) => {
        const row = payload.new as { user_id?: string; cards?: RondaCard[]; version?: number };
        if (row.user_id === userId && row.cards && typeof row.version === "number") acceptHand({ version: row.version, cards: row.cards });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ronda_seats", filter }, () => void refreshSeats())
      .subscribe();

    // Filet de sécurité : relire la table régulièrement et au retour sur l'app.
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshView();
        if (!versionRef.current) void refreshSeats();
      }
    }, 6000);
    const onWake = () => {
      if (document.visibilityState === "visible") {
        void refreshView();
        void refreshSeats();
      }
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    return () => {
      void supabase().removeChannel(channel);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [state.table?.id, userId, refreshSeats, refreshView, accept, acceptHand]);

  const act = useCallback(
    async (body: Record<string, unknown>): Promise<CallResult> => {
      const tableId = tableIdRef.current;
      if (!tableId) return { ok: false, error: "not_seated" };
      const res = await callRonda({ ...body, tableId });
      await refreshView();
      return res;
    },
    [refreshView],
  );

  const play = useCallback((card: RondaCard, announce?: RondaAnnounce) => act({ op: "play", card, ...(announce ? { announce } : {}) }), [act]);
  const announce = useCallback((kind: RondaAnnounce) => act({ op: "announce", kind }), [act]);
  const tick = useCallback(async () => {
    await act({ op: "tick" });
  }, [act]);

  /** Le Patron donne les chaises libres à des bots (le serveur vérifie que c'est bien lui). */
  const addBots = useCallback(async () => {
    const res = await act({ op: "bots" });
    await refreshSeats();
    return res;
  }, [act, refreshSeats]);

  const mySeat = state.seats.find((s) => s.userId === userId)?.seat ?? null;
  return { ...state, mySeat, play, announce, tick, addBots, refreshSeats };
}
