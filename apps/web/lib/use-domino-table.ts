"use client";

import type { End, TileId } from "@icosium/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-context";
import {
  type DominoView,
  type SeatInfo,
  type TableInfo,
  callDomino,
  fetchMyHand,
  fetchSeats,
  fetchTable,
  fetchView,
} from "./domino-client";
import { supabase } from "./supabase";

export type TableState = {
  loading: boolean;
  joinError: string | null;
  table: TableInfo | null;
  seats: SeatInfo[];
  view: DominoView | null;
  version: number;
  hand: TileId[];
  /** Décalage entre l'horloge du serveur et celle du téléphone (ms). */
  clockOffset: number;
};

function sampleOffset(ref: { current: number | null }, sentAt: number): number {
  const s = sentAt - Date.now();
  ref.current = ref.current === null ? s : Math.max(ref.current, s);
  return ref.current;
}

/**
 * Tout ce qu'il faut pour une table : on s'assoit (ou on revient à sa place), puis on suit
 * la partie en temps réel. Si le temps réel décroche, on relit la table régulièrement.
 */
export function useDominoTable(code: string) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<TableState>({
    loading: true,
    joinError: null,
    table: null,
    seats: [],
    view: null,
    version: 0,
    hand: [],
    clockOffset: 0,
  });
  const versionRef = useRef(0);
  // Décalage d'horloge : chaque état dit quand le serveur l'a écrit (sentAt). Comme il arrive toujours
  // un peu après, sentAt - maintenant sous-estime le décalage ; on garde donc la plus grande mesure.
  // Un état relu plus tard (relecture de secours) donne une mesure trop basse et ne fait plus sauter le chrono.
  const offsetRef = useRef<number | null>(null);
  const tableIdRef = useRef<string | null>(null);

  const refreshView = useCallback(async () => {
    const tableId = tableIdRef.current;
    if (!tableId || !userId) return;
    const [v, h] = await Promise.all([fetchView(tableId), fetchMyHand(tableId, userId)]);
    setState((s) => {
      if (v && v.version < versionRef.current) return s;
      if (v) versionRef.current = v.version;
      return {
        ...s,
        view: v?.view ?? s.view,
        version: v?.version ?? s.version,
        hand: h?.tiles ?? s.hand,
        clockOffset: v ? sampleOffset(offsetRef, v.view.sentAt) : s.clockOffset,
      };
    });
  }, [userId]);

  const refreshSeats = useCallback(async () => {
    const tableId = tableIdRef.current;
    if (!tableId) return;
    const [seats, table] = await Promise.all([fetchSeats(tableId), fetchTable(tableId)]);
    setState((s) => ({ ...s, seats, table: table ?? s.table }));
  }, []);

  // 1. S'asseoir à la table (ou retrouver sa place après un rechargement).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const res = await callDomino({ op: "join", code });
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
      .channel(`domino:${tableId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "domino_states", filter }, (payload) => {
        const row = payload.new as { version?: number; view?: DominoView };
        if (!row.view || typeof row.version !== "number" || row.version < versionRef.current) return;
        versionRef.current = row.version;
        const view = row.view;
        setState((s) => ({ ...s, view, version: row.version as number, clockOffset: sampleOffset(offsetRef, view.sentAt) }));
        void fetchMyHand(tableId, userId).then((h) => h && setState((s) => ({ ...s, hand: h.tiles })));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "domino_hands", filter }, (payload) => {
        const row = payload.new as { user_id?: string; tiles?: TileId[] };
        if (row.user_id === userId && row.tiles) setState((s) => ({ ...s, hand: row.tiles as TileId[] }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "domino_seats", filter }, () => void refreshSeats())
      .subscribe();

    // Filet de sécurité : relire la table régulièrement et au retour sur l'app.
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshView();
        if (!versionRef.current) void refreshSeats();
      }
    }, 8000);
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
  }, [state.table?.id, userId, refreshSeats, refreshView]);

  const play = useCallback(
    async (tile: TileId, end: End) => {
      const tableId = tableIdRef.current;
      if (!tableId) return { ok: false as const, error: "not_seated" };
      const res = await callDomino({ op: "play", tableId, tile, end });
      await refreshView();
      return res;
    },
    [refreshView],
  );

  const tick = useCallback(async () => {
    const tableId = tableIdRef.current;
    if (!tableId) return;
    await callDomino({ op: "tick", tableId });
    await refreshView();
  }, [refreshView]);

  const nextRound = useCallback(async () => {
    const tableId = tableIdRef.current;
    if (!tableId) return;
    await callDomino({ op: "next", tableId });
    await refreshView();
  }, [refreshView]);

  /** Le Patron donne les chaises libres à des bots (le serveur vérifie que c'est bien lui). */
  const addBots = useCallback(async () => {
    const tableId = tableIdRef.current;
    if (!tableId) return { ok: false as const, error: "not_seated" };
    const res = await callDomino({ op: "bots", tableId });
    await Promise.all([refreshSeats(), refreshView()]);
    return res;
  }, [refreshSeats, refreshView]);

  /** Donne « 6 pierres d'une famille » : redéclarer ou garder. */
  const declare = useCallback(
    async (choice: "redeclare" | "keep") => {
      const tableId = tableIdRef.current;
      if (!tableId) return;
      await callDomino({ op: "declare", tableId, choice });
      await refreshView();
    },
    [refreshView],
  );

  const mySeat = state.seats.find((s) => s.userId === userId)?.seat ?? null;
  return { ...state, mySeat, play, tick, nextRound, addBots, declare };
}
