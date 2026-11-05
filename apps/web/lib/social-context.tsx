"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { supabase } from "./supabase";
import { useVoice } from "./voice-context";

/** Un ami, une demande reçue ou envoyée. */
export type Friend = { id: string; username: string; status: "pending" | "accepted"; incoming: boolean; since: string };

/** Une conversation à deux, telle que la liste « Messages » l'affiche. */
export type Conversation = {
  id: string;
  state: "active" | "request";
  otherId: string;
  otherUsername: string;
  lastBody: string | null;
  lastKind: "text" | "invite" | null;
  lastSender: string | null;
  lastAt: string;
  unread: number;
  otherReadAt: string;
};

/** Où est quelqu'un en ce moment (présence en temps réel, jamais enregistrée). */
export type Presence = { status: "online" | "table" | "voice"; game?: "domino" };

type SocialValue = {
  ready: boolean;
  friends: Friend[];
  conversations: Conversation[];
  /** Messages non lus dans « Messages » (les demandes sont comptées à part). */
  unread: number;
  /** Demandes d'amis reçues + demandes de message. */
  pendingRequests: number;
  presenceOf: (userId: string) => Presence | null;
  refresh: () => Promise<void>;
};

const SocialContext = createContext<SocialValue | null>(null);

type ConversationRow = {
  conversation_id: string;
  state: "active" | "request";
  other_id: string;
  other_username: string;
  last_body: string | null;
  last_kind: "text" | "invite" | null;
  last_sender: string | null;
  last_at: string;
  unread: number;
  other_read_at: string;
};

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const pathname = usePathname();
  const voice = useVoice();
  const [ready, setReady] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [presence, setPresence] = useState<Record<string, Presence>>({});

  const refresh = useCallback(async () => {
    if (!userId) return;
    const client = supabase();
    const [f, c] = await Promise.all([client.rpc("my_friends"), client.rpc("my_conversations")]);
    if (f.data) {
      setFriends(
        (f.data as { other_id: string; username: string; status: Friend["status"]; incoming: boolean; since: string }[]).map((r) => ({
          id: r.other_id,
          username: r.username,
          status: r.status,
          incoming: r.incoming,
          since: r.since,
        })),
      );
    }
    if (c.data) {
      setConversations(
        (c.data as ConversationRow[]).map((r) => ({
          id: r.conversation_id,
          state: r.state,
          otherId: r.other_id,
          otherUsername: r.other_username,
          lastBody: r.last_body,
          lastKind: r.last_kind,
          lastSender: r.last_sender,
          lastAt: r.last_at,
          unread: r.unread,
          otherReadAt: r.other_read_at,
        })),
      );
    }
    setReady(true);
  }, [userId]);

  // Chargement, puis mise à jour en temps réel (nouveau message, demande d'ami, lecture).
  useEffect(() => {
    if (!userId) {
      setFriends([]);
      setConversations([]);
      setReady(false);
      return;
    }
    void refresh();
    let timer: number | undefined;
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(), 250);
    };
    const channel = supabase()
      .channel(`social:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, soon)
      .subscribe();
    // Retour sur l'app (onglet, réseau) : on se remet à jour.
    const onFocus = () => soon();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      void supabase().removeChannel(channel);
    };
  }, [userId, refresh]);

  // Présence : je dis où je suis (en ligne, à une table, en vocal) ; je vois où sont les autres.
  const mine = useMemo<Presence>(() => {
    if (/^\/play\/[A-Za-z]{4}$/.test(pathname ?? "")) return { status: "table", game: "domino" };
    if (voice.status === "connected" || voice.status === "reconnecting") return { status: "voice" };
    return { status: "online" };
  }, [pathname, voice.status]);
  const presenceChannel = useRef<RealtimeChannel | null>(null);
  useEffect(() => {
    if (!userId) return;
    const channel = supabase().channel("presence:cafe", { config: { presence: { key: userId } } });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Presence>();
        const next: Record<string, Presence> = {};
        for (const [id, metas] of Object.entries(state)) {
          const last = metas[metas.length - 1];
          if (last) next[id] = { status: last.status, ...(last.game ? { game: last.game } : {}) };
        }
        setPresence(next);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track(mineRef.current);
      });
    presenceChannel.current = channel;
    return () => {
      presenceChannel.current = null;
      void supabase().removeChannel(channel);
    };
  }, [userId]);
  const mineRef = useRef(mine);
  useEffect(() => {
    mineRef.current = mine;
    void presenceChannel.current?.track(mine);
  }, [mine]);

  const value = useMemo<SocialValue>(() => {
    const unread = conversations.filter((c) => c.state === "active").reduce((n, c) => n + c.unread, 0);
    const pendingRequests =
      friends.filter((f) => f.incoming && f.status === "pending").length + conversations.filter((c) => c.state === "request").length;
    return {
      ready,
      friends,
      conversations,
      unread,
      pendingRequests,
      presenceOf: (id) => (id === userId ? mine : (presence[id] ?? null)),
      refresh,
    };
  }, [ready, friends, conversations, presence, refresh, userId, mine]);

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial(): SocialValue {
  const value = useContext(SocialContext);
  if (!value) throw new Error("useSocial must be used inside SocialProvider");
  return value;
}

// ---------- actions (la base vérifie tout et a le dernier mot) ----------

export type FriendRequestResult = "sent" | "accepted" | "already" | "not_found" | "self" | "blocked" | "rate_limited" | "error";

export async function sendFriendRequest(username: string): Promise<FriendRequestResult> {
  const { data, error } = await supabase().rpc("send_friend_request", { target_username: username });
  return error ? "error" : (data as FriendRequestResult);
}

export async function respondFriendRequest(other: string, accept: boolean): Promise<void> {
  await supabase().rpc("respond_friend_request", { other, accept });
}

export async function removeFriend(other: string): Promise<void> {
  await supabase().rpc("remove_friend", { other });
}

export async function blockUser(other: string): Promise<void> {
  await supabase().rpc("block_user", { other });
}

export async function unblockUser(other: string): Promise<void> {
  await supabase().rpc("unblock_user", { other });
}

/** Signale quelqu'un (raison + détails), éventuellement à propos d'un message précis. */
export async function reportUser(other: string, reason: string, messageId?: string): Promise<"ok" | "rate_limited" | "error"> {
  const { data, error } = await supabase().rpc("report_user", { other, reason, message: messageId ?? null });
  return error ? "error" : (data as "ok" | "rate_limited");
}

/** Ouvre (ou retrouve) la conversation avec cette personne ; null si c'est impossible (blocage). */
export async function openConversation(other: string): Promise<string | null> {
  const { data, error } = await supabase().rpc("open_direct_conversation", { other });
  return error ? null : ((data as string | null) ?? null);
}

export type InviteMeta = { game: "domino"; code: string; players: number; free: number };

export async function sendMessage(conversation: string, body: string, invite?: InviteMeta): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase().rpc("send_message", {
    p_conversation: conversation,
    p_body: body,
    p_kind: invite ? "invite" : "text",
    p_meta: invite ?? null,
  });
  if (error) {
    const known = ["blocked", "rate_limited", "invalid_body", "not_member"].find((k) => error.message.includes(k));
    return { ok: false, error: known ?? (error.message.toLowerCase().includes("fetch") ? "network" : "error") };
  }
  return { ok: true, id: data as string };
}

export async function markRead(conversation: string): Promise<void> {
  await supabase().rpc("mark_conversation_read", { p_conversation: conversation });
}

export async function setConversationState(conversation: string, state: "active" | "declined"): Promise<void> {
  await supabase().rpc("set_conversation_state", { p_conversation: conversation, p_state: state });
}
