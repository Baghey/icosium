"use client";

/**
 * Appels vocaux privés entre amis. L'appel est une ligne de la table `calls` (le serveur décide :
 * amis seulement, un appel à la fois) ; la voix passe par la couche vocale LiveKit habituelle,
 * dans un salon à deux places « call-<id> ». Changer de page ne coupe donc pas l'appel.
 * Comme partout dans ICOSIUM, on arrive micro coupé.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { playRing } from "./sound";
import { supabase } from "./supabase";
import { useVoice } from "./voice-context";

export type CallPhase = "ringing" | "connecting" | "active";

export type CallState = {
  id: string;
  conversationId: string;
  otherId: string;
  otherName: string;
  role: "caller" | "callee";
  phase: CallPhase;
  /** Quand l'appel a décroché (pour le chrono). */
  answeredAt: number | null;
};

export type CallError = "busy" | "not_friends" | "rate_limited" | "error" | null;

type CallValue = {
  call: CallState | null;
  error: CallError;
  /** L'écran d'appel est ouvert en grand (sinon : la barre vocale en haut suffit). */
  expanded: boolean;
  setExpanded: (on: boolean) => void;
  start: (conversationId: string, otherId: string, otherName: string) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  hangUp: () => Promise<void>;
  clearError: () => void;
};

type CallRow = {
  id: string;
  conversation_id: string;
  caller: string;
  callee: string;
  status: "ringing" | "active" | "declined" | "missed" | "ended";
  created_at: string;
  answered_at: string | null;
};

/** Personne ne décroche : l'appel s'arrête (côté serveur aussi, après 45 s). */
const RING_TIMEOUT_MS = 40_000;

export const callRoomName = (id: string) => `call-${id}`;

const CallContext = createContext<CallValue | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const me = user?.id ?? null;
  const voice = useVoice();
  // La couche vocale change souvent (qui parle…) : on la lit par une référence, pour que
  // l'abonnement aux appels ne soit pas recréé à chaque fois.
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const [call, setCall] = useState<CallState | null>(null);
  const [error, setError] = useState<CallError>(null);
  const [expanded, setExpanded] = useState(false);
  const callRef = useRef(call);
  callRef.current = call;
  const joinedRoom = useRef<string | null>(null);

  const nameOf = useCallback(async (id: string) => {
    const { data } = await supabase().from("profiles").select("username").eq("id", id).maybeSingle();
    return (data?.username as string | undefined) ?? "…";
  }, []);

  /** L'appel est fini (raccroché, refusé, manqué) : on quitte le salon s'il le faut. */
  const finish = useCallback(() => {
    const room = joinedRoom.current;
    joinedRoom.current = null;
    setCall(null);
    setExpanded(false);
    const v = voiceRef.current;
    if (room && v.roomName === room) void v.leave();
  }, []);

  const enterRoom = useCallback(
    async (c: CallState) => {
      const room = callRoomName(c.id);
      joinedRoom.current = room;
      setCall({ ...c, phase: "connecting" });
      await voiceRef.current.join(room);
    },
    [],
  );

  // Les changements d'appels (sonnerie, décroché, raccroché) arrivent en temps réel ; la RLS ne
  // montre à chacun que ses propres appels.
  useEffect(() => {
    if (!me) return;
    const client = supabase();
    const onRow = async (row: CallRow) => {
      const current = callRef.current;
      if (current && current.id === row.id) {
        if (row.status === "active" && current.role === "caller" && current.phase === "ringing") {
          void enterRoom({ ...current, answeredAt: row.answered_at ? Date.parse(row.answered_at) : Date.now() });
        } else if (row.status !== "ringing" && row.status !== "active") {
          finish();
        }
        return;
      }
      // Un nouvel appel pour moi (si je ne suis pas déjà en appel).
      if (row.status === "ringing" && row.callee === me && !current && Date.now() - Date.parse(row.created_at) < RING_TIMEOUT_MS) {
        const otherName = await nameOf(row.caller);
        if (callRef.current) return;
        setCall({ id: row.id, conversationId: row.conversation_id, otherId: row.caller, otherName, role: "callee", phase: "ringing", answeredAt: null });
        setExpanded(true);
      }
    };
    const channel = client
      .channel(`calls:${me}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calls" }, (payload) => void onRow(payload.new as CallRow))
      .subscribe((status) => {
        // Au (re)branchement : un appel qui sonne encore pour moi ?
        if (status !== "SUBSCRIBED") return;
        void client
          .from("calls")
          .select("id, conversation_id, caller, callee, status, created_at, answered_at")
          .eq("callee", me)
          .eq("status", "ringing")
          .order("created_at", { ascending: false })
          .limit(1)
          .then(({ data }) => {
            const row = (data as CallRow[] | null)?.[0];
            if (row) void onRow(row);
          });
      });
    return () => void client.removeChannel(channel);
  }, [me, enterRoom, finish, nameOf]);

  // Dans le salon : l'appel est en cours. Si on quitte le salon (bouton « Quitter », coupure
  // définitive), on raccroche pour l'autre aussi.
  useEffect(() => {
    if (!call || !joinedRoom.current) return;
    if (voice.roomName === joinedRoom.current && voice.status === "connected" && call.phase === "connecting") {
      setCall({ ...call, phase: "active", answeredAt: call.answeredAt ?? Date.now() });
    }
    const failed = call.phase === "connecting" && voice.status === "idle" && voice.error !== null;
    if (failed || (call.phase === "active" && voice.status === "idle" && voice.roomName === null)) {
      void supabase().rpc("end_call", { p_call: call.id });
      finish();
    }
  }, [call, voice.roomName, voice.status, voice.error, finish]);

  // Sonnerie (et vibration pour celui qu'on appelle) tant que ça sonne.
  useEffect(() => {
    if (call?.phase !== "ringing") return;
    const ring = () => {
      playRing(call.role === "caller");
      if (call.role === "callee") {
        try {
          navigator.vibrate?.([220, 120, 220]);
        } catch {
          // pas de vibration ici
        }
      }
    };
    ring();
    const timer = window.setInterval(ring, 2600);
    // Personne ne répond : appel manqué.
    const timeout = window.setTimeout(() => {
      if (call.role === "caller") void supabase().rpc("end_call", { p_call: call.id });
      finish();
    }, RING_TIMEOUT_MS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(timeout);
    };
  }, [call?.phase, call?.role, call?.id, finish]);

  // Se déconnecter du compte : fin de l'appel.
  useEffect(() => {
    if (!me && callRef.current) finish();
  }, [me, finish]);

  const start = useCallback(
    async (conversationId: string, otherId: string, otherName: string) => {
      if (callRef.current) return;
      setError(null);
      const { data, error: err } = await supabase().rpc("start_call", { p_conversation: conversationId });
      if (err || !data) {
        const msg = err?.message ?? "";
        setError(msg.includes("busy") ? "busy" : msg.includes("not_friends") ? "not_friends" : msg.includes("rate_limited") ? "rate_limited" : "error");
        return;
      }
      setCall({ id: data as string, conversationId, otherId, otherName, role: "caller", phase: "ringing", answeredAt: null });
      setExpanded(true);
    },
    [],
  );

  const accept = useCallback(async () => {
    const c = callRef.current;
    if (!c || c.role !== "callee" || c.phase !== "ringing") return;
    setCall({ ...c, phase: "connecting" });
    const { data } = await supabase().rpc("answer_call", { p_call: c.id, p_accept: true });
    if (data !== "active") {
      finish();
      return;
    }
    await enterRoom({ ...c, answeredAt: Date.now() });
  }, [enterRoom, finish]);

  const decline = useCallback(async () => {
    const c = callRef.current;
    if (!c) return;
    finish();
    await supabase().rpc("answer_call", { p_call: c.id, p_accept: false });
  }, [finish]);

  const hangUp = useCallback(async () => {
    const c = callRef.current;
    if (!c) return;
    finish();
    await supabase().rpc("end_call", { p_call: c.id });
  }, [finish]);

  const value = useMemo<CallValue>(
    () => ({ call, error, expanded, setExpanded, start, accept, decline, hangUp, clearError: () => setError(null) }),
    [call, error, expanded, start, accept, decline, hangUp],
  );
  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall(): CallValue {
  const value = useContext(CallContext);
  if (!value) throw new Error("useCall must be used inside CallProvider");
  return value;
}
