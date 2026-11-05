"use client";

import type { MessageKey } from "@icosium/i18n";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { AddFriendIcon, ChatIcon, CheckIcon, CloseIcon, MoreIcon } from "@/components/cafe-icons";
import { PersonActions } from "@/components/social/person-actions";
import { PersonAvatar } from "@/components/social/person-avatar";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useT } from "@/lib/i18n";
import { presenceKey, shortTime } from "@/lib/social-format";
import {
  type Conversation,
  type Friend,
  type FriendRequestResult,
  openConversation,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  setConversationState,
  useSocial,
} from "@/lib/social-context";

export default function FriendsPage() {
  return (
    <AppShell>
      <Suspense>
        <Friends />
      </Suspense>
    </AppShell>
  );
}

type Tab = "messages" | "friends" | "requests";

function Friends() {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const { ready, friends, conversations, unread, pendingRequests } = useSocial();
  const initial = (params.get("tab") as Tab | null) ?? "messages";
  const [tab, setTab] = useState<Tab>(["messages", "friends", "requests"].includes(initial) ? initial : "messages");

  const select = (next: Tab) => {
    setTab(next);
    router.replace(`/friends?tab=${next}`, { scroll: false });
  };

  const tabs: { id: Tab; label: MessageKey; badge: number }[] = [
    { id: "messages", label: "social.tabMessages", badge: unread },
    { id: "friends", label: "social.tabFriends", badge: 0 },
    { id: "requests", label: "social.tabRequests", badge: pendingRequests },
  ];

  return (
    <div className="animate-rise flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-gilded text-3xl font-bold">{t("social.title")}</h1>
        <p className="text-ink-muted">{t("social.subtitle")}</p>
      </header>

      <div role="tablist" className="cafe-card flex gap-1 p-1">
        {tabs.map((x) => (
          <button
            key={x.id}
            role="tab"
            type="button"
            aria-selected={tab === x.id}
            onClick={() => select(x.id)}
            className={`relative flex min-h-touch flex-1 items-center justify-center gap-1.5 rounded-control text-sm font-bold transition-all duration-200 ease-icos ${
              tab === x.id ? "gold-button" : "text-cafe-muted"
            }`}
          >
            {t(x.label)}
            {x.badge > 0 && (
              <span className={`animate-pop flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${tab === x.id ? "bg-cafe-0 text-gold-light" : "bg-[#e0533d] text-white"}`}>
                {x.badge > 9 ? "9+" : x.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {!ready ? (
        <p className="py-8 text-center text-ink-muted">{t("common.loading")}</p>
      ) : tab === "messages" ? (
        <Messages conversations={conversations.filter((c) => c.state === "active")} onFind={() => select("friends")} />
      ) : tab === "friends" ? (
        <FriendList friends={friends.filter((f) => f.status === "accepted")} />
      ) : (
        <Requests friends={friends.filter((f) => f.status === "pending")} requests={conversations.filter((c) => c.state === "request")} />
      )}
    </div>
  );
}

function Empty({ text, action }: { text: MessageKey; action?: { label: MessageKey; onClick: () => void } }) {
  const t = useT();
  return (
    <div className="cafe-card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <ChatIcon className="size-10 text-gold/70" />
      <p className="text-ink-muted">{t(text)}</p>
      {action && (
        <button type="button" onClick={action.onClick} className="gold-button min-h-touch rounded-full px-5 text-sm font-bold">
          {t(action.label)}
        </button>
      )}
    </div>
  );
}

function Messages({ conversations, onFind }: { conversations: Conversation[]; onFind: () => void }) {
  if (conversations.length === 0) return <Empty text="social.noMessages" action={{ label: "home.findFriends", onClick: onFind }} />;
  return (
    <ul className="cafe-card flex flex-col divide-y divide-gold/10 overflow-hidden">
      {conversations.map((c) => (
        <li key={c.id}>
          <ConversationRow c={c} />
        </li>
      ))}
    </ul>
  );
}

function ConversationRow({ c }: { c: Conversation }) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { presenceOf } = useSocial();
  const mine = c.lastSender === user?.id;
  const preview = c.lastKind === "invite" ? t("social.invitePreview") : (c.lastBody ?? "");
  return (
    <Link href={`/friends/${c.id}`} className="flex min-h-18 items-center gap-3 px-4 py-3 transition-colors duration-150 active:bg-white/5">
      <PersonAvatar id={c.otherId} size={50} presence={presenceOf(c.otherId)} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate ${c.unread ? "font-bold text-ink" : "font-semibold"}`}>{c.otherUsername}</span>
          {c.lastBody !== null && <span className={`shrink-0 text-xs ${c.unread ? "text-gold-light" : "text-ink-muted"}`}>{shortTime(c.lastAt, locale, t)}</span>}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm ${c.unread ? "text-ink" : "text-ink-muted"}`}>
            {mine ? t("social.youPrefix") : ""}
            {preview}
          </span>
          {c.unread > 0 && (
            <span className="animate-pop flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-cafe-0">
              {c.unread > 9 ? "9+" : c.unread}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}


const ADD_KEYS: Record<FriendRequestResult, MessageKey> = {
  sent: "social.add.sent",
  accepted: "social.add.accepted",
  already: "social.add.already",
  not_found: "social.add.not_found",
  self: "social.add.self",
  blocked: "social.add.blocked",
  rate_limited: "social.add.rate_limited",
  error: "social.add.error",
};

function AddFriend() {
  const t = useT();
  const { refresh } = useSocial();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ key: FriendRequestResult; name: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    const r = await sendFriendRequest(clean);
    setBusy(false);
    setResult({ key: r, name: clean });
    if (r === "sent" || r === "accepted") {
      setName("");
      void refresh();
    }
  }

  const ok = result?.key === "sent" || result?.key === "accepted";
  return (
    <form onSubmit={submit} className="cafe-card flex flex-col gap-2 p-4">
      <label htmlFor="add-friend" className="section-title">
        {t("social.addTitle")}
      </label>
      <div className="flex gap-2">
        <input
          id="add-friend"
          value={name}
          maxLength={20}
          autoCapitalize="none"
          autoComplete="off"
          placeholder={t("social.addPlaceholder")}
          onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))}
          className="cafe-input min-h-touch w-0 flex-1 px-3"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="gold-button flex min-h-touch items-center gap-1.5 rounded-control px-4 font-bold transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
        >
          <AddFriendIcon className="size-5" />
          {t("social.addButton")}
        </button>
      </div>
      {result && (
        <p role={ok ? "status" : "alert"} className={`animate-fade text-sm ${ok ? "text-online" : "text-danger"}`}>
          {t(ADD_KEYS[result.key], { name: result.name })}
        </p>
      )}
    </form>
  );
}

function FriendList({ friends }: { friends: Friend[] }) {
  const t = useT();
  const router = useRouter();
  const { presenceOf } = useSocial();
  const [menu, setMenu] = useState<Friend | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  // En ligne d'abord, puis par nom.
  const sorted = [...friends].sort((a, b) => Number(!!presenceOf(b.id)) - Number(!!presenceOf(a.id)) || a.username.localeCompare(b.username));

  async function write(f: Friend) {
    setOpening(f.id);
    const id = await openConversation(f.id);
    setOpening(null);
    if (id) router.push(`/friends/${id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <AddFriend />
      {sorted.length === 0 ? (
        <Empty text="social.noFriends" />
      ) : (
        <ul className="cafe-card flex flex-col divide-y divide-gold/10 overflow-hidden">
          {sorted.map((f) => {
            const p = presenceOf(f.id);
            return (
              <li key={f.id} className="flex min-h-18 items-center gap-3 px-4 py-3">
                <PersonAvatar id={f.id} size={48} presence={p} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{f.username}</span>
                  <span className={`truncate text-xs ${p ? (p.status === "table" ? "text-gold-light" : "text-online") : "text-ink-muted"}`}>{t(presenceKey(p))}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void write(f)}
                  disabled={opening === f.id}
                  aria-label={`${t("social.message")} ${f.username}`}
                  className="flex size-touch items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold-light transition-transform duration-150 active:scale-90 disabled:opacity-50"
                >
                  <ChatIcon className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setMenu(f)}
                  aria-label={t("social.menu")}
                  className="flex size-touch items-center justify-center rounded-full text-cafe-muted transition-colors duration-150 active:bg-white/10"
                >
                  <MoreIcon className="size-5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {menu && <PersonActions id={menu.id} name={menu.username} isFriend onClose={() => setMenu(null)} />}
    </div>
  );
}

function Requests({ friends, requests }: { friends: Friend[]; requests: Conversation[] }) {
  const t = useT();
  const { refresh } = useSocial();
  const incoming = friends.filter((f) => f.incoming);
  const outgoing = friends.filter((f) => !f.incoming);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    await action();
    await refresh();
    setBusy(null);
  }

  if (incoming.length + outgoing.length + requests.length === 0) return <Empty text="social.noRequests" />;

  const round = "flex size-touch items-center justify-center rounded-full transition-transform duration-150 active:scale-90 disabled:opacity-50";
  return (
    <div className="flex flex-col gap-5">
      {incoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="section-title">{t("social.incoming")}</h2>
          <ul className="cafe-card flex flex-col divide-y divide-gold/10 overflow-hidden">
            {incoming.map((f) => (
              <li key={f.id} className="animate-fade flex min-h-18 items-center gap-3 px-4 py-3">
                <PersonAvatar id={f.id} size={46} />
                <span className="min-w-0 flex-1 truncate font-semibold">{f.username}</span>
                <button type="button" disabled={busy === f.id} aria-label={t("social.decline")} onClick={() => void act(f.id, () => respondFriendRequest(f.id, false))} className={`${round} border border-gold/30 text-cafe-muted`}>
                  <CloseIcon className="size-5" />
                </button>
                <button type="button" disabled={busy === f.id} aria-label={t("social.accept")} onClick={() => void act(f.id, () => respondFriendRequest(f.id, true))} className={`${round} gold-button`}>
                  <CheckIcon className="size-5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {requests.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="section-title">{t("social.messageRequests")}</h2>
          <p className="text-xs text-ink-muted">{t("social.messageRequestHint")}</p>
          <ul className="cafe-card flex flex-col divide-y divide-gold/10 overflow-hidden">
            {requests.map((c) => (
              <li key={c.id} className="flex items-center gap-1 pe-3">
                <div className="min-w-0 flex-1">
                  <ConversationRow c={c} />
                </div>
                <button type="button" disabled={busy === c.id} aria-label={t("social.requestDelete")} onClick={() => void act(c.id, () => setConversationState(c.id, "declined"))} className={`${round} border border-gold/30 text-cafe-muted`}>
                  <CloseIcon className="size-5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="section-title">{t("social.outgoing")}</h2>
          <ul className="cafe-card flex flex-col divide-y divide-gold/10 overflow-hidden">
            {outgoing.map((f) => (
              <li key={f.id} className="flex min-h-16 items-center gap-3 px-4 py-2.5">
                <PersonAvatar id={f.id} size={40} />
                <span className="min-w-0 flex-1 truncate font-semibold">{f.username}</span>
                <span className="text-xs text-ink-muted">{t("social.pending")}</span>
                <button type="button" disabled={busy === f.id} onClick={() => void act(f.id, () => removeFriend(f.id))} className="min-h-touch rounded-full px-3 text-sm font-semibold text-cafe-muted">
                  {t("social.cancel")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
