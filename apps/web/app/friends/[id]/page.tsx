"use client";

import type { MessageKey } from "@icosium/i18n";
import type { RealtimeChannel } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { BackIcon, CheckIcon, FlagIcon, MoreIcon, PhoneIcon, SendIcon, TrashIcon } from "@/components/cafe-icons";
import { MicIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { GroupAvatar, GroupInfoSheet } from "@/components/social/groups";
import { CallLine, InviteCard, ResultCard, SystemLine, type CallMeta, type ResultMeta, type SystemMeta } from "@/components/social/message-cards";
import { PersonActions } from "@/components/social/person-actions";
import { PersonAvatar } from "@/components/social/person-avatar";
import { VoiceNotePlayer, formatSeconds } from "@/components/social/voice-note";
import { useAuth } from "@/lib/auth-context";
import { useCall } from "@/lib/call-context";
import { useI18n } from "@/lib/i18n";
import {
  type InviteMeta,
  type MessageKind,
  REACTIONS,
  type Reaction,
  type SendResult,
  type VoiceMeta,
  blockUser,
  conversationName,
  markRead,
  reactToMessage,
  sendMessage,
  sendVoiceMessage,
  setConversationState,
  useSocial,
} from "@/lib/social-context";
import { presenceKey } from "@/lib/social-format";
import { supabase } from "@/lib/supabase";
import { VOICE_NOTE_MAX_SECONDS, type VoiceNote, useVoiceRecorder } from "@/lib/voice-recorder";

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell bare>
      <Conversation id={id} />
    </AppShell>
  );
}

type Message = {
  id: string;
  sender: string | null;
  kind: MessageKind;
  body: string;
  meta: Record<string, unknown> | null;
  at: string;
  /** Message pas encore confirmé par le serveur (envoi en cours ou raté). */
  local?: "sending" | "failed";
  /** Message vocal enregistré ici, gardé tant qu'il n'est pas parti. */
  note?: VoiceNote;
};

type Row = { id: string; sender_id: string | null; kind: MessageKind; body: string; meta: Record<string, unknown> | null; created_at: string };
const fromRow = (r: Row): Message => ({ id: r.id, sender: r.sender_id, kind: r.kind, body: r.body, meta: r.meta, at: r.created_at });

type ReactionRow = { message_id: string; user_id: string; emoji: Reaction };

/** Messages qu'on affiche au milieu, hors des grappes de bulles. */
const CENTERED: MessageKind[] = ["result", "call", "system"];

const SEND_ERRORS: Record<string, MessageKey> = {
  blocked: "social.error.blocked",
  rate_limited: "social.error.rate_limited",
  invalid_body: "social.error.invalid_body",
  not_member: "social.error.not_member",
  invalid_voice: "social.error.error",
  network: "social.error.network",
};

const RECORDER_ERRORS: Record<string, MessageKey> = {
  micDenied: "social.voice.micDenied",
  unsupported: "social.voice.unsupported",
  tooShort: "social.voice.hold",
};

function Conversation({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const me = user?.id ?? "";
  const { conversations, friends, presenceOf, refresh, ready } = useSocial();
  const call = useCall();
  const conv = conversations.find((c) => c.id === id);
  const isGroup = conv?.kind === "group";
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);
  const [typing, setTyping] = useState<Record<string, string>>({});
  const [menu, setMenu] = useState(false);
  const [picked, setPicked] = useState<Message | null>(null);
  const [reportMsg, setReportMsg] = useState<Message | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastTypingSent = useRef(0);
  const typingTimers = useRef<Record<string, number>>({});

  const otherId = conv?.otherId ?? null;
  const isFriend = !!otherId && friends.some((f) => f.id === otherId && f.status === "accepted");
  const names = useMemo(() => Object.fromEntries((conv?.members ?? []).map((m) => [m.id, m.username])), [conv?.members]);

  const loadReactions = useCallback(async () => {
    const { data } = await supabase().from("message_reactions").select("message_id, user_id, emoji").eq("conversation_id", id);
    if (data) setReactions(data as ReactionRow[]);
  }, [id]);

  // Les 80 derniers messages, puis les nouveaux en temps réel.
  useEffect(() => {
    let alive = true;
    const client = supabase();
    const load = async () => {
      const { data } = await client
        .from("messages")
        .select("id, sender_id, kind, body, meta, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: false })
        .limit(80);
      if (!alive || !data) return;
      setMessages((prev) => {
        const server = [...(data as Row[])].reverse().map(fromRow);
        const pending = prev.filter((m) => m.local && !server.some((s) => s.id === m.id));
        return [...server, ...pending];
      });
      setLoaded(true);
      void loadReactions();
    };
    void load();
    const channel = client
      .channel(`conv:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` }, (payload) => {
        const m = fromRow(payload.new as Row);
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        const from = m.sender;
        if (from) setTyping(({ [from]: _gone, ...rest }) => rest);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions", filter: `conversation_id=eq.${id}` }, () => void loadReactions())
      // Une réaction retirée ne passe pas par la base en temps réel : l'autre nous prévient.
      .on("broadcast", { event: "reactions" }, () => void loadReactions())
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as { user?: string; name?: string };
        if (!p.user || p.user === me) return;
        const who = p.user;
        setTyping((prev) => ({ ...prev, [who]: p.name ?? "…" }));
        window.clearTimeout(typingTimers.current[who]);
        typingTimers.current[who] = window.setTimeout(() => setTyping(({ [who]: _gone, ...rest }) => rest), 3500);
      })
      .subscribe((status) => {
        // Après une coupure, on recharge pour ne rien rater.
        if (status === "SUBSCRIBED") void load();
      });
    channelRef.current = channel;
    const onOnline = () => void load();
    window.addEventListener("online", onOnline);
    return () => {
      alive = false;
      channelRef.current = null;
      window.removeEventListener("online", onOnline);
      void client.removeChannel(channel);
    };
  }, [id, me, loadReactions]);

  // Lu : dès qu'on voit la conversation, et à chaque nouveau message reçu.
  const lastIncoming = [...messages].reverse().find((m) => m.sender !== me && !m.local)?.id;
  // (Pas l'objet `conv` en dépendance : il change à chaque mise à jour de la liste, et marquer
  // « lu » met la liste à jour : ça tournerait en boucle.)
  const convState = conv?.state;
  useEffect(() => {
    if (!lastIncoming || !convState || convState === "request") return;
    void markRead(id).then(refresh);
  }, [id, lastIncoming, convState, refresh]);

  // Toujours collé en bas quand un message arrive.
  const typingCount = Object.keys(typing).length;
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, typingCount]);

  // Les envois partent l'un après l'autre, pour garder l'ordre des messages.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const deliver = useCallback(
    async (m: Message) => {
      const send = (): Promise<SendResult> => (m.kind === "voice" && m.note ? sendVoiceMessage(id, me, m.note) : sendMessage(id, m.body));
      const sent = queue.current.then(send);
      queue.current = sent.catch(() => undefined);
      const res = await sent.catch((): SendResult => ({ ok: false, error: "network" }));
      setMessages((prev) =>
        res.ok
          ? prev.some((x) => x.id === res.id)
            ? prev.filter((x) => x.id !== m.id)
            : prev.map((x) => (x.id === m.id ? { ...x, id: res.id, local: undefined } : x))
          : prev.map((x) => (x.id === m.id ? { ...x, local: "failed" } : x)),
      );
      if (!res.ok) setError(SEND_ERRORS[res.error] ?? "social.error.error");
      else {
        setError(null);
        void refresh();
      }
    },
    [id, me, refresh],
  );

  const retry = useCallback(
    (m: Message) => {
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, local: "sending" } : x)));
      void deliver(m);
    },
    [deliver],
  );

  // Les messages ratés repartent seuls quand le réseau revient.
  useEffect(() => {
    const onOnline = () => messages.filter((m) => m.local === "failed").forEach(retry);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [messages, retry]);

  function post(m: Omit<Message, "id" | "sender" | "at" | "local">) {
    const local: Message = { ...m, id: `local-${Date.now()}`, sender: me, at: new Date().toISOString(), local: "sending" };
    setMessages((prev) => [...prev, local]);
    void deliver(local);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    post({ kind: "text", body, meta: null });
  }

  const recorder = useVoiceRecorder((note) =>
    post({ kind: "voice", body: "", meta: { path: "", duration: note.duration, peaks: note.peaks } satisfies VoiceMeta, note }),
  );

  function onType(value: string) {
    setText(value);
    const now = Date.now();
    if (value && now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { user: me } });
    }
  }

  async function react(m: Message, emoji: Reaction) {
    setPicked(null);
    const mineNow = reactions.find((r) => r.message_id === m.id && r.user_id === me)?.emoji;
    // Tout de suite à l'écran ; la base confirme ensuite.
    setReactions((prev) => [
      ...prev.filter((r) => !(r.message_id === m.id && r.user_id === me)),
      ...(mineNow === emoji ? [] : [{ message_id: m.id, user_id: me, emoji }]),
    ]);
    const ok = await reactToMessage(m.id, emoji);
    if (!ok) void loadReactions();
    void channelRef.current?.send({ type: "broadcast", event: "reactions", payload: {} });
  }

  // « Vu » sous mon dernier message, si l'autre (ou quelqu'un du groupe) l'a lu.
  const lastSent = [...messages].reverse().find((m) => !m.local && m.kind !== "system");
  const lastMine = lastSent?.sender === me ? lastSent : undefined;
  const seen = !!lastMine && !!conv && new Date(conv.otherReadAt).getTime() >= new Date(lastMine.at).getTime();

  const groups = useMemo(() => groupMessages(messages, me), [messages, me]);
  const presence = otherId ? presenceOf(otherId) : null;
  const name = conv ? conversationName(conv) : "…";
  const typingNames = Object.entries(typing).map(([uid, n]) => names[uid] ?? n);
  const subtitle = typingNames.length
    ? isGroup
      ? t("social.typingName", { name: typingNames.join(", ") })
      : t("social.typing")
    : isGroup
      ? t("social.group.count", { n: (conv?.members.length ?? 0) + 1 })
      : t(presenceKey(presence));
  const canCall = !isGroup && isFriend && !call.call;

  // La conversation n'existe plus (groupe quitté, personne bloquée) : retour à la liste.
  useEffect(() => {
    if (ready && loaded && !conv && messages.length === 0) router.replace("/friends");
  }, [ready, loaded, conv, messages.length, router]);

  return (
    <div className="fixed inset-x-0 bottom-0 flex flex-col" style={{ top: "var(--voicebar, 0px)" }}>
      <header className="cafe-panel z-10 flex items-center gap-2 border-x-0 border-t-0 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <Link href="/friends" aria-label={t("social.back")} className="flex size-touch items-center justify-center rounded-full text-gold-light active:bg-white/10">
          <BackIcon className="size-6 rtl:rotate-180" />
        </Link>
        <button
          type="button"
          disabled={!conv}
          onClick={() => setMenu(true)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control py-0.5 text-start active:bg-white/5"
          aria-label={t("social.menu")}
        >
          {isGroup && conv ? <GroupAvatar members={conv.members} size={40} /> : otherId && <PersonAvatar id={otherId} size={40} presence={presence} />}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-bold">{name}</span>
            <span className={`truncate text-xs ${typingNames.length ? "text-gold-light" : presence && !isGroup ? "text-online" : "text-cafe-muted"}`}>{subtitle}</span>
          </span>
        </button>
        {canCall && otherId && (
          <button
            type="button"
            onClick={() => void call.start(id, otherId, name)}
            aria-label={t("call.start", { name })}
            className="flex size-touch items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold-light transition-transform duration-150 active:scale-90"
          >
            <PhoneIcon className="size-5" />
          </button>
        )}
        {conv && (
          <button type="button" onClick={() => setMenu(true)} aria-label={t("social.menu")} className="flex size-touch items-center justify-center rounded-full text-cafe-muted active:bg-white/10">
            <MoreIcon className="size-5" />
          </button>
        )}
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4" aria-live="polite" aria-label={t("social.conversationWith", { name })}>
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          {loaded && messages.length === 0 && (
            <div className="animate-rise flex flex-col items-center gap-2 py-10 text-center">
              {isGroup && conv ? <GroupAvatar members={conv.members} size={84} /> : otherId && <PersonAvatar id={otherId} size={84} presence={presence} />}
              <p className="text-lg font-bold">{name}</p>
              <p className="text-sm text-cafe-muted">{subtitle}</p>
            </div>
          )}
          {groups.map((g) => (
            <div key={g.key} className="flex flex-col gap-1">
              {g.day && <p className="my-2 text-center text-[11px] font-semibold tracking-wider text-cafe-muted uppercase">{dayLabel(g.day, locale, t)}</p>}
              {g.centered ? (
                <Centered m={g.items[0]!} me={me} onCallBack={canCall && otherId ? () => void call.start(id, otherId, name) : undefined} />
              ) : (
                <div className={`flex items-end gap-2 ${g.mine ? "flex-row-reverse" : ""}`}>
                  {!g.mine && g.sender && <PersonAvatar id={g.sender} size={28} />}
                  <div className={`flex min-w-0 flex-col gap-0.5 ${g.mine ? "items-end" : "items-start"}`}>
                    {isGroup && !g.mine && g.sender && (
                      <span className="ps-3 text-[11px] font-semibold" style={{ color: `hsl(${hueOf(g.sender)} 60% 72%)` }}>
                        {names[g.sender] ?? "…"}
                      </span>
                    )}
                    {g.items.map((m, i) => (
                      <Bubble
                        key={m.id}
                        m={m}
                        mine={g.mine}
                        first={i === 0}
                        last={i === g.items.length - 1}
                        reactions={reactions.filter((r) => r.message_id === m.id)}
                        me={me}
                        onRetry={() => retry(m)}
                        onPick={() => !m.local && setPicked(m)}
                        onReact={(emoji) => void react(m, emoji)}
                      />
                    ))}
                    <span className="px-1 text-[10px] text-cafe-muted">{new Date(g.items[g.items.length - 1]!.at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
          {seen && conv?.state === "active" && (
            <p className="animate-fade -mt-2 flex items-center justify-end gap-1 pe-1 text-[11px] text-gold-light">
              <CheckIcon className="size-3.5" />
              {t("social.seen")}
            </p>
          )}
          {typingCount > 0 && (
            <div className="animate-fade flex items-end gap-2">
              <PersonAvatar id={Object.keys(typing)[0]!} size={28} />
              <span className="flex gap-1 rounded-[1.25rem] rounded-es-md bg-cafe-2/90 px-4 py-3 ring-1 ring-gold/15" aria-label={t("social.typing")}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-1.5 animate-bounce rounded-full bg-gold-light/80" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </span>
            </div>
          )}
        </div>
      </div>

      {conv?.state === "request" && otherId && (
        <div className="cafe-panel animate-sheet mx-3 mb-2 flex flex-col gap-2 rounded-card p-3 text-sm">
          <p>{t("social.requestBanner", { name })}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => void setConversationState(id, "active").then(refresh)} className="gold-button min-h-touch flex-1 rounded-control font-bold">
              {t("social.requestAccept")}
            </button>
            <button
              type="button"
              onClick={() => void setConversationState(id, "declined").then(refresh).then(() => router.replace("/friends?tab=requests"))}
              className="min-h-touch flex-1 rounded-control border border-gold/30 font-semibold"
            >
              {t("social.requestDelete")}
            </button>
            <button
              type="button"
              onClick={() => void blockUser(otherId).then(refresh).then(() => router.replace("/friends"))}
              className="min-h-touch rounded-control px-3 font-semibold text-danger"
            >
              {t("social.block")}
            </button>
          </div>
        </div>
      )}

      {(error || recorder.error) && (
        <p role="alert" className="animate-fade mx-3 mb-1 text-center text-xs text-danger">
          {t(error ?? RECORDER_ERRORS[recorder.error ?? ""] ?? "social.error.error")}
        </p>
      )}

      <Composer
        text={text}
        onType={onType}
        onSubmit={submit}
        recorder={recorder}
        onRecordStart={() => {
          setError(null);
          recorder.clearError();
        }}
      />

      {menu && conv && isGroup && <GroupInfoSheet id={id} title={name} members={conv.members} onClose={() => setMenu(false)} />}
      {menu && otherId && !isGroup && (
        <PersonActions id={otherId} name={name} isFriend={isFriend} onClose={() => setMenu(false)} onBlocked={() => router.replace("/friends")} />
      )}
      {picked && (
        <MessageMenu
          m={picked}
          mineReaction={reactions.find((r) => r.message_id === picked.id && r.user_id === me)?.emoji ?? null}
          canReport={!!picked.sender && picked.sender !== me}
          onReact={(emoji) => void react(picked, emoji)}
          onReport={() => {
            setReportMsg(picked);
            setPicked(null);
          }}
          onClose={() => setPicked(null)}
        />
      )}
      {reportMsg?.sender && (
        <PersonActions
          id={reportMsg.sender}
          name={names[reportMsg.sender] ?? name}
          isFriend={friends.some((f) => f.id === reportMsg.sender && f.status === "accepted")}
          initialMode="report"
          messageId={reportMsg.id}
          onClose={() => setReportMsg(null)}
        />
      )}
    </div>
  );
}

// ---------- la zone d'écriture : texte, ou appui long sur le micro pour un message vocal ----------

/** Distance (px) à glisser vers le début de la ligne pour annuler un enregistrement. */
const CANCEL_DRAG = 90;

function Composer({
  text,
  onType,
  onSubmit,
  recorder,
  onRecordStart,
}: {
  text: string;
  onType: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  recorder: ReturnType<typeof useVoiceRecorder>;
  onRecordStart: () => void;
}) {
  const { t } = useI18n();
  const startX = useRef(0);
  const [drag, setDrag] = useState(0);
  const recording = recorder.state !== "idle";
  const cancelArmed = drag > CANCEL_DRAG;

  const begin = () => {
    onRecordStart();
    setDrag(0);
    void recorder.start();
  };
  const end = (send: boolean) => {
    recorder.stop(send && !cancelArmed);
    setDrag(0);
  };

  return (
    <form onSubmit={onSubmit} className="cafe-panel relative flex items-end gap-2 border-x-0 border-b-0 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {recording ? (
        <div className="animate-fade flex min-h-touch flex-1 items-center gap-2.5 overflow-hidden rounded-[1.4rem] border border-[#e0533d]/40 bg-cafe-0/80 ps-3 pe-2" aria-live="polite">
          <span className={`size-2.5 shrink-0 rounded-full bg-[#e0533d] ${recorder.state === "recording" ? "animate-rec" : "opacity-40"}`} aria-hidden="true" />
          <span className="text-sm font-semibold text-cafe-text tabular-nums">
            {formatSeconds(recorder.elapsed)}
            <span className="text-cafe-muted"> / {formatSeconds(VOICE_NOTE_MAX_SECONDS)}</span>
          </span>
          {cancelArmed ? (
            <span className="flex flex-1 items-center justify-center gap-1.5 text-sm font-bold text-danger">
              <TrashIcon className="size-4" />
              {t("social.voice.release")}
            </span>
          ) : (
            <>
              <span className="flex h-6 flex-1 items-center justify-end gap-[2px] overflow-hidden" aria-hidden="true">
                {recorder.live.map((v, i) => (
                  <span key={i} className="w-[3px] shrink-0 rounded-full bg-gold-light/85 transition-[height] duration-100" style={{ height: `${Math.min(100, 14 + v * 600)}%` }} />
                ))}
              </span>
              <span className="hidden text-[11px] text-cafe-muted min-[380px]:inline">‹ {t("social.voice.slide")}</span>
            </>
          )}
        </div>
      ) : (
        <>
          <label htmlFor="msg" className="sr-only">
            {t("social.placeholder")}
          </label>
          <textarea
            id="msg"
            rows={1}
            value={text}
            maxLength={1000}
            placeholder={t("social.placeholder")}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            className="cafe-input max-h-32 min-h-touch flex-1 resize-none rounded-[1.4rem] px-4 py-2.5 leading-snug [field-sizing:content]"
          />
        </>
      )}
      {text.trim() && !recording ? (
        <button
          type="submit"
          aria-label={t("social.send")}
          className="gold-button animate-pop flex size-touch shrink-0 items-center justify-center rounded-full transition-transform duration-150 active:scale-90"
        >
          <SendIcon className="size-5 rtl:-scale-x-100" />
        </button>
      ) : (
        <button
          type="button"
          aria-label={t("social.voice.record")}
          title={t("social.voice.hold")}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            startX.current = e.clientX;
            begin();
          }}
          onPointerMove={(e) => {
            if (!recording) return;
            const rtl = document.documentElement.dir === "rtl";
            setDrag(Math.max(0, rtl ? e.clientX - startX.current : startX.current - e.clientX));
          }}
          onPointerUp={() => end(true)}
          onPointerCancel={() => end(false)}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !e.repeat) {
              e.preventDefault();
              begin();
            }
          }}
          onKeyUp={(e) => {
            if (e.key === " " || e.key === "Enter") end(true);
          }}
          onContextMenu={(e) => e.preventDefault()}
          className={`relative flex size-touch shrink-0 touch-none items-center justify-center rounded-full transition-all duration-200 select-none ${
            recording ? "bg-[#e0533d] text-white shadow-[0_0_0_8px_rgb(224_83_61/0.18)]" : "gold-button active:scale-90"
          }`}
          style={recording ? { transform: `translateX(${-Math.min(drag, CANCEL_DRAG + 20)}px) scale(1.12)` } : undefined}
        >
          <MicIcon className="size-5" />
        </button>
      )}
    </form>
  );
}

// ---------- appui long sur une bulle : réactions et signalement ----------

function MessageMenu({
  m,
  mineReaction,
  canReport,
  onReact,
  onReport,
  onClose,
}: {
  m: Message;
  mineReaction: Reaction | null;
  canReport: boolean;
  onReact: (e: Reaction) => void;
  onReport: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const preview = m.kind === "text" ? m.body : m.kind === "voice" ? t("social.voicePreview") : m.kind === "invite" ? t("social.invitePreview") : "";
  return (
    <Sheet onClose={onClose} label={t("social.react")}>
      {preview && <p className="mb-4 line-clamp-2 rounded-control bg-white/5 px-3 py-2 text-sm text-cafe-muted">{preview}</p>}
      <div role="group" aria-label={t("social.react")} className="mb-3 flex justify-between gap-1">
        {REACTIONS.map((e, i) => (
          <button
            key={e}
            type="button"
            aria-pressed={mineReaction === e}
            onClick={() => onReact(e)}
            className={`animate-pop flex size-12 items-center justify-center rounded-full text-[1.7rem] transition-transform duration-150 active:scale-125 ${
              mineReaction === e ? "bg-gold/25 ring-2 ring-gold" : "bg-white/5"
            }`}
            style={{ animationDelay: `${i * 30}ms` }}
          >
            {e}
          </button>
        ))}
      </div>
      {canReport && (
        <button type="button" onClick={onReport} className="flex min-h-14 w-full items-center gap-3 rounded-control px-3 text-start font-semibold text-danger active:bg-white/10">
          <FlagIcon className="size-5" />
          {t("social.reportMessage")}
        </button>
      )}
    </Sheet>
  );
}

function Centered({ m, me, onCallBack }: { m: Message; me: string; onCallBack?: () => void }) {
  if (m.kind === "result" && m.meta) return <ResultCard meta={m.meta as ResultMeta} me={me} />;
  if (m.kind === "call" && m.meta) return <CallLine meta={m.meta as CallMeta} mine={m.sender === me} onCallBack={onCallBack} />;
  if (m.kind === "system" && m.meta) return <SystemLine meta={m.meta as SystemMeta} />;
  return null;
}

type Group = { key: string; sender: string | null; mine: boolean; centered: boolean; day: string | null; items: Message[] };

/** Messages d'une même personne, à moins de 3 minutes d'écart : une seule grappe de bulles. */
function groupMessages(messages: Message[], me: string): Group[] {
  return messages.reduce<Group[]>((groups, m) => {
    const prev = groups[groups.length - 1];
    const last = prev?.items[prev.items.length - 1];
    const day = new Date(m.at).toDateString();
    const newDay = !last || new Date(last.at).toDateString() !== day;
    const centered = CENTERED.includes(m.kind);
    if (prev && last && !newDay && !centered && !prev.centered && prev.sender === m.sender && new Date(m.at).getTime() - new Date(last.at).getTime() < 180_000) {
      prev.items.push(m);
    } else {
      groups.push({ key: m.id, sender: m.sender, mine: m.sender === me, centered, day: newDay ? m.at : null, items: [m] });
    }
    return groups;
  }, []);
}

function dayLabel(iso: string, locale: string, t: (k: MessageKey) => string): string {
  const d = new Date(iso);
  const days = Math.round((new Date(new Date().toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days === 0) return t("social.today");
  if (days === 1) return t("social.yesterday");
  return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
}

function hueOf(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** Appui long (ou clic droit) : ouvrir le menu du message. */
function useLongPress(onLong: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const origin = useRef({ x: 0, y: 0 });
  const cancel = () => window.clearTimeout(timer.current);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      origin.current = { x: e.clientX, y: e.clientY };
      cancel();
      timer.current = window.setTimeout(() => {
        try {
          navigator.vibrate?.(10);
        } catch {
          // pas de vibration
        }
        onLong();
      }, 420);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (Math.abs(e.clientX - origin.current.x) + Math.abs(e.clientY - origin.current.y) > 12) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      cancel();
      onLong();
    },
  };
}

function Bubble({
  m,
  mine,
  first,
  last,
  reactions,
  me,
  onRetry,
  onPick,
  onReact,
}: {
  m: Message;
  mine: boolean;
  first: boolean;
  last: boolean;
  reactions: ReactionRow[];
  me: string;
  onRetry: () => void;
  onPick: () => void;
  onReact: (e: Reaction) => void;
}) {
  const { t } = useI18n();
  const press = useLongPress(onPick);
  // Coins arrondis façon messagerie : le coin côté personne se resserre au milieu d'une grappe.
  const corners = mine
    ? `${first ? "" : "rounded-se-md"} ${last ? "" : "rounded-ee-md"}`
    : `${first ? "" : "rounded-ss-md"} ${last ? "" : "rounded-es-md"}`;
  const failed = m.local === "failed";
  const skin = mine
    ? "bg-[linear-gradient(180deg,#f0cf80,#d8a748)] text-[#2a1a08] shadow-[0_3px_10px_rgb(0_0_0/0.3)]"
    : "bg-cafe-2/90 text-cafe-text ring-1 ring-gold/15";

  let content: ReactNode;
  if (m.kind === "invite" && m.meta) {
    content = <InviteCard meta={m.meta as InviteMeta} corners={corners} />;
  } else if (m.kind === "voice" && m.meta) {
    content = (
      <div className={`rounded-[1.25rem] px-2.5 py-1.5 ${corners} ${skin} ${m.local === "sending" ? "opacity-70" : ""} ${failed ? "ring-2 ring-danger" : ""} ${last ? "animate-pop" : ""}`}>
        <VoiceNotePlayer meta={m.meta as VoiceMeta} localUrl={m.note?.url} mine={mine} />
        {failed && (
          <button type="button" onClick={onRetry} className="block min-h-touch w-full text-start text-[11px] font-semibold text-[#8a1f10]">
            {t("social.failed")}
          </button>
        )}
      </div>
    );
  } else {
    // Un bouton seulement pour réessayer : un bouton désactivé ne reçoit pas l'appui long.
    const cls = `max-w-[78vw] rounded-[1.25rem] px-3.5 py-2 text-start text-[15px] leading-snug break-words whitespace-pre-wrap sm:max-w-sm ${corners} ${skin} ${
      m.local === "sending" ? "opacity-70" : ""
    } ${failed ? "ring-2 ring-danger" : ""} ${last ? "animate-pop" : ""}`;
    content = failed ? (
      <button type="button" onClick={onRetry} className={cls}>
        {m.body}
        <span className="mt-1 block text-[11px] font-semibold text-[#8a1f10]">{t("social.failed")}</span>
      </button>
    ) : (
      <div className={cls}>{m.body}</div>
    );
  }

  // Les réactions, regroupées par emoji, posées sur le bord bas de la bulle.
  const counts = REACTIONS.map((e) => ({ e, n: reactions.filter((r) => r.emoji === e).length, mine: reactions.some((r) => r.emoji === e && r.user_id === me) })).filter(
    (x) => x.n > 0,
  );
  return (
    <div {...press} className={`relative flex flex-col [-webkit-touch-callout:none] ${mine ? "items-end" : "items-start"} ${counts.length ? "mb-3" : ""}`}>
      {content}
      {counts.length > 0 && (
        <div className={`absolute -bottom-3.5 flex gap-0.5 ${mine ? "end-2" : "start-2"}`}>
          {counts.map((c) => (
            <button
              key={c.e}
              type="button"
              onClick={() => onReact(c.e)}
              aria-label={`${c.e} ${c.n}`}
              aria-pressed={c.mine}
              className={`animate-react flex h-6 items-center gap-0.5 rounded-full border px-1.5 text-[13px] leading-none shadow-md ${
                c.mine ? "border-gold bg-cafe-1" : "border-gold/25 bg-cafe-1/95"
              }`}
            >
              {c.e}
              {c.n > 1 && <span className="text-[10px] font-bold text-cafe-muted">{c.n}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
