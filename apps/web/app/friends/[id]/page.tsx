"use client";

import type { MessageKey } from "@icosium/i18n";
import type { RealtimeChannel } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { BackIcon, CheckIcon, DominoIcon, MoreIcon, SendIcon } from "@/components/cafe-icons";
import { PersonActions } from "@/components/social/person-actions";
import { PersonAvatar } from "@/components/social/person-avatar";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { type InviteMeta, blockUser, markRead, sendMessage, setConversationState, useSocial } from "@/lib/social-context";
import { supabase } from "@/lib/supabase";
import { presenceKey } from "@/lib/social-format";

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
  sender: string;
  kind: "text" | "invite";
  body: string;
  meta: InviteMeta | null;
  at: string;
  /** Message pas encore confirmé par le serveur (envoi en cours ou raté). */
  local?: "sending" | "failed";
};

type Row = { id: string; sender_id: string; kind: "text" | "invite"; body: string; meta: InviteMeta | null; created_at: string };
const fromRow = (r: Row): Message => ({ id: r.id, sender: r.sender_id, kind: r.kind, body: r.body, meta: r.meta, at: r.created_at });

const SEND_ERRORS: Record<string, MessageKey> = {
  blocked: "social.error.blocked",
  rate_limited: "social.error.rate_limited",
  invalid_body: "social.error.invalid_body",
  not_member: "social.error.not_member",
  network: "social.error.network",
};

function Conversation({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const me = user?.id ?? "";
  const { conversations, friends, presenceOf, refresh } = useSocial();
  const conv = conversations.find((c) => c.id === id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);
  const [typing, setTyping] = useState(false);
  const [menu, setMenu] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const typingChannel = useRef<RealtimeChannel | null>(null);
  const lastTypingSent = useRef(0);

  const otherId = conv?.otherId ?? null;
  const isFriend = !!otherId && friends.some((f) => f.id === otherId && f.status === "accepted");

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
        const server = (data as Row[]).reverse().map(fromRow);
        const pending = prev.filter((m) => m.local);
        return [...server, ...pending];
      });
      setLoaded(true);
    };
    void load();
    const channel = client
      .channel(`conv:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` }, (payload) => {
        const m = fromRow(payload.new as Row);
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.sender !== me) setTyping(false);
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if ((payload as { user?: string }).user === me) return;
        setTyping(true);
        window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => setTyping(false), 3500);
      })
      .subscribe((status) => {
        // Après une coupure, on recharge pour ne rien rater.
        if (status === "SUBSCRIBED") void load();
      });
    typingChannel.current = channel;
    const onOnline = () => void load();
    window.addEventListener("online", onOnline);
    return () => {
      alive = false;
      typingChannel.current = null;
      window.removeEventListener("online", onOnline);
      void client.removeChannel(channel);
    };
  }, [id, me]);
  const typingTimer = useRef<number | undefined>(undefined);

  // Lu : dès qu'on voit la conversation, et à chaque nouveau message reçu.
  const lastIncoming = [...messages].reverse().find((m) => m.sender !== me && !m.local)?.id;
  useEffect(() => {
    if (!lastIncoming || !conv || conv.state === "request") return;
    void markRead(id).then(refresh);
  }, [id, lastIncoming, conv, refresh]);

  // Toujours collé en bas quand un message arrive.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, typing]);

  // Les envois partent l'un après l'autre, pour garder l'ordre des messages.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const deliver = useCallback(
    async (localId: string, body: string) => {
      const sent = queue.current.then(() => sendMessage(id, body));
      queue.current = sent.catch(() => undefined);
      const res = await sent;
      setMessages((prev) =>
        res.ok
          ? prev.some((m) => m.id === res.id)
            ? prev.filter((m) => m.id !== localId)
            : prev.map((m) => (m.id === localId ? { ...m, id: res.id, local: undefined } : m))
          : prev.map((m) => (m.id === localId ? { ...m, local: "failed" } : m)),
      );
      if (!res.ok) setError(SEND_ERRORS[res.error] ?? "social.error.error");
      else {
        setError(null);
        void refresh();
      }
    },
    [id, refresh],
  );

  // Les messages ratés repartent seuls quand le réseau revient.
  useEffect(() => {
    const retry = () => {
      for (const m of messages) if (m.local === "failed") {
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, local: "sending" } : x)));
        void deliver(m.id, m.body);
      }
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [messages, deliver]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const localId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: localId, sender: me, kind: "text", body, meta: null, at: new Date().toISOString(), local: "sending" }]);
    setText("");
    void deliver(localId, body);
  }

  function onType(value: string) {
    setText(value);
    const now = Date.now();
    if (value && now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      void typingChannel.current?.send({ type: "broadcast", event: "typing", payload: { user: me } });
    }
  }

  // « Vu » sous mon dernier message, si l'autre l'a lu (et seulement s'il a accepté la conversation).
  const lastSent = [...messages].reverse().find((m) => !m.local);
  const lastMine = lastSent?.sender === me ? lastSent : undefined;
  const seen = !!lastMine && !!conv && new Date(conv.otherReadAt).getTime() >= new Date(lastMine.at).getTime();

  const groups = useMemo(() => groupMessages(messages, me), [messages, me]);
  const presence = otherId ? presenceOf(otherId) : null;
  const name = conv?.otherUsername ?? "…";

  return (
    <div className="fixed inset-x-0 bottom-0 flex flex-col" style={{ top: "var(--voicebar, 0px)" }}>
      <header className="cafe-panel z-10 flex items-center gap-2 border-x-0 border-t-0 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <Link href="/friends" aria-label={t("social.back")} className="flex size-touch items-center justify-center rounded-full text-gold-light active:bg-white/10">
          <BackIcon className="size-6 rtl:rotate-180" />
        </Link>
        {otherId && <PersonAvatar id={otherId} size={40} presence={presence} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate font-bold">{name}</h1>
          <p className={`truncate text-xs ${presence ? "text-online" : "text-cafe-muted"}`}>{typing ? t("social.typing") : t(presenceKey(presence))}</p>
        </div>
        {otherId && (
          <button type="button" onClick={() => setMenu(true)} aria-label={t("social.menu")} className="flex size-touch items-center justify-center rounded-full text-cafe-muted active:bg-white/10">
            <MoreIcon className="size-5" />
          </button>
        )}
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4" aria-live="polite" aria-label={t("social.conversationWith", { name })}>
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          {loaded && messages.length === 0 && otherId && (
            <div className="animate-rise flex flex-col items-center gap-2 py-10 text-center">
              <PersonAvatar id={otherId} size={84} presence={presence} />
              <p className="text-lg font-bold">{name}</p>
              <p className="text-sm text-cafe-muted">{t(presenceKey(presence))}</p>
            </div>
          )}
          {groups.map((g) => (
            <div key={g.key} className="flex flex-col gap-1">
              {g.day && <p className="my-2 text-center text-[11px] font-semibold tracking-wider text-cafe-muted uppercase">{dayLabel(g.day, locale, t)}</p>}
              <div className={`flex items-end gap-2 ${g.mine ? "flex-row-reverse" : ""}`}>
                {!g.mine && <PersonAvatar id={g.sender} size={28} />}
                <div className={`flex min-w-0 flex-col gap-0.5 ${g.mine ? "items-end" : "items-start"}`}>
                  {g.items.map((m, i) => (
                    <Bubble key={m.id} m={m} mine={g.mine} first={i === 0} last={i === g.items.length - 1} onRetry={() => {
                      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, local: "sending" } : x)));
                      void deliver(m.id, m.body);
                    }} />
                  ))}
                  <span className="px-1 text-[10px] text-cafe-muted">{new Date(g.items[g.items.length - 1]!.at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            </div>
          ))}
          {seen && conv?.state === "active" && (
            <p className="animate-fade -mt-2 flex items-center justify-end gap-1 pe-1 text-[11px] text-gold-light">
              <CheckIcon className="size-3.5" />
              {t("social.seen")}
            </p>
          )}
          {typing && (
            <div className="animate-fade flex items-end gap-2">
              {otherId && <PersonAvatar id={otherId} size={28} />}
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

      {error && (
        <p role="alert" className="animate-fade mx-3 mb-1 text-center text-xs text-danger">
          {t(error)}
        </p>
      )}

      <form onSubmit={submit} className="cafe-panel flex items-end gap-2 border-x-0 border-b-0 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label={t("social.send")}
          className="gold-button flex size-touch shrink-0 items-center justify-center rounded-full transition-transform duration-150 active:scale-90 disabled:opacity-40"
        >
          <SendIcon className="size-5 rtl:-scale-x-100" />
        </button>
      </form>

      {menu && otherId && (
        <PersonActions id={otherId} name={name} isFriend={isFriend} onClose={() => setMenu(false)} onBlocked={() => router.replace("/friends")} />
      )}
    </div>
  );
}

type Group = { key: string; sender: string; mine: boolean; day: string | null; items: Message[] };

/** Messages d'une même personne, à moins de 3 minutes d'écart : une seule grappe de bulles. */
function groupMessages(messages: Message[], me: string): Group[] {
  return messages.reduce<Group[]>((groups, m) => {
    const prev = groups[groups.length - 1];
    const last = prev?.items[prev.items.length - 1];
    const day = new Date(m.at).toDateString();
    const newDay = !last || new Date(last.at).toDateString() !== day;
    if (prev && last && !newDay && prev.sender === m.sender && new Date(m.at).getTime() - new Date(last.at).getTime() < 180_000) {
      prev.items.push(m);
    } else {
      groups.push({ key: m.id, sender: m.sender, mine: m.sender === me, day: newDay ? m.at : null, items: [m] });
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

function Bubble({ m, mine, first, last, onRetry }: { m: Message; mine: boolean; first: boolean; last: boolean; onRetry: () => void }) {
  const { t } = useI18n();
  // Coins arrondis façon messagerie : le coin côté personne se resserre au milieu d'une grappe.
  const corners = mine
    ? `${first ? "" : "rounded-se-md"} ${last ? "" : "rounded-ee-md"}`
    : `${first ? "" : "rounded-ss-md"} ${last ? "" : "rounded-es-md"}`;
  if (m.kind === "invite" && m.meta) {
    return (
      <div className={`animate-pop w-64 max-w-[78vw] overflow-hidden rounded-[1.25rem] ${corners} border border-gold/50 shadow-[0_8px_20px_rgb(0_0_0/0.4)]`}>
        <div className="felt-table felt-grain flex items-center gap-3 !border-0 p-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-black/35 text-gold-light ring-1 ring-gold/50">
            <DominoIcon className="size-6" />
          </span>
          <span className="flex flex-col">
            <span className="text-gilded font-bold">{t(m.meta.game === "ludo" ? "social.inviteCardLudo" : "social.inviteCard")}</span>
            <span className="font-mono text-lg font-bold tracking-[0.3em] text-cafe-text" dir="ltr">
              {m.meta.code}
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 bg-cafe-1/95 px-3 py-2">
          <span className="text-xs text-cafe-muted">{t("social.inviteSeats", { free: m.meta.free })}</span>
          <Link href={`/${m.meta.game === "ludo" ? "ludo" : "play"}/${m.meta.code}`} className="gold-button flex min-h-9 items-center rounded-full px-4 text-sm font-bold">
            {t("social.inviteJoin")}
          </Link>
        </div>
      </div>
    );
  }
  const failed = m.local === "failed";
  return (
    <button
      type="button"
      disabled={!failed}
      onClick={onRetry}
      className={`max-w-[78vw] rounded-[1.25rem] px-3.5 py-2 text-start text-[15px] leading-snug break-words whitespace-pre-wrap sm:max-w-sm ${corners} ${
        mine
          ? "bg-[linear-gradient(180deg,#f0cf80,#d8a748)] text-[#2a1a08] shadow-[0_3px_10px_rgb(0_0_0/0.3)]"
          : "bg-cafe-2/90 text-cafe-text ring-1 ring-gold/15"
      } ${m.local === "sending" ? "opacity-70" : ""} ${failed ? "ring-2 ring-danger" : ""} ${last ? "animate-pop" : ""} disabled:cursor-default`}
    >
      {m.body}
      {failed && <span className="mt-1 block text-[11px] font-semibold text-[#8a1f10]">{t("social.failed")}</span>}
    </button>
  );
}
