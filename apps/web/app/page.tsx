"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AddFriendIcon, BotIcon, ChatIcon, Emblem } from "@/components/cafe-icons";
import { DominoTile } from "@/components/domino/tile";
import { GroupAvatar } from "@/components/social/groups";
import { PersonAvatar } from "@/components/social/person-avatar";
import { useAuth } from "@/lib/auth-context";
import { callDomino } from "@/lib/domino-client";
import { useI18n } from "@/lib/i18n";
import { lastPreview, presenceKey, shortTime } from "@/lib/social-format";
import { conversationName, useSocial } from "@/lib/social-context";
import { DEFAULT_DOMINO_OPTIONS } from "@icosium/shared";

type Status = { accounts: boolean; voice: boolean } | null;

export default function HomePage() {
  return (
    <AppShell>
      <Home />
    </AppShell>
  );
}

function Home() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const { friends, conversations, presenceOf } = useSocial();
  const [status, setStatus] = useState<Status>(null);
  const [solo, setSolo] = useState(false);

  useEffect(() => {
    fetch("/api/status", { cache: "no-store" })
      .then((r) => r.json() as Promise<Status>)
      .then(setStatus)
      .catch(() => setStatus({ accounts: false, voice: false }));
  }, []);

  const online = friends.filter((f) => f.status === "accepted" && presenceOf(f.id));
  const recent = conversations.filter((c) => c.state === "active" && c.lastBody !== null).slice(0, 3);
  const healthy = status ? status.accounts && status.voice : null;
  // Un invité sans pseudo s'appelle « guest_1a2b3c4d » : on ne l'affiche pas, on l'invite à en choisir un.
  const isTechnicalName = Boolean(user?.username?.startsWith("guest_"));

  async function playSolo() {
    setSolo(true);
    const res = await callDomino({ op: "create", options: DEFAULT_DOMINO_OPTIONS, solo: true });
    if (res.ok) router.push(`/play/${res.data.code as string}`);
    else setSolo(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* L'enseigne du café. */}
      <header className="animate-rise flex flex-col items-center gap-1 pt-2 text-center">
        <Emblem className="size-16 drop-shadow-[0_0_18px_rgb(216_167_72/0.45)]" />
        <p className="text-gilded text-[0.7rem] font-bold tracking-[0.42em] uppercase">{t("app.name")}</p>
        <h1 className="text-gilded text-3xl leading-tight font-bold">
          {isTechnicalName ? t("home.greetingGuest") : t("home.greeting", { name: user?.username ?? "" })}
        </h1>
        {isTechnicalName && (
          <Link href="/profile" className="flex min-h-touch items-center text-sm font-semibold text-gold-light underline decoration-gold/40 underline-offset-4">
            {t("home.pickName")}
          </Link>
        )}
        <p className="text-sm text-ink-muted">{t("home.tagline")}</p>
      </header>

      {/* La table de domino, en grand : l'action principale. */}
      <Link
        href="/play"
        className="animate-rise group relative block overflow-hidden rounded-[1.6rem] border border-gold/50 shadow-[0_18px_40px_rgb(0_0_0/0.55)] transition-transform duration-200 active:scale-[0.98]"
        style={{ animationDelay: "60ms" }}
      >
        <div className="felt-table felt-grain relative flex min-h-48 flex-col justify-end !rounded-[1.6rem] p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/rosette.webp" alt="" aria-hidden="true" className="pointer-events-none absolute end-[-1.5rem] top-[-1.5rem] size-44 opacity-25" />
          <span className="absolute end-6 top-5 flex gap-1.5 transition-transform duration-250 ease-icos group-hover:-rotate-3 group-active:rotate-0" dir="ltr" aria-hidden="true">
            <span className="rotate-[-14deg] drop-shadow-[0_6px_8px_rgb(0_0_0/0.5)]">
              <DominoTile a={6} b={6} orientation="vertical" size={26} />
            </span>
            <span className="mt-3 rotate-[10deg] drop-shadow-[0_6px_8px_rgb(0_0_0/0.5)]">
              <DominoTile a={5} b={3} orientation="vertical" size={26} />
            </span>
          </span>
          <span className="relative flex flex-col gap-0.5 pe-24">
            <span className="text-gilded text-2xl font-bold drop-shadow">{t("home.playNow")}</span>
            <span className="text-sm text-cafe-text/85">{t("home.playNowHint")}</span>
          </span>
          <span className="gold-button relative mt-3 flex min-h-touch w-fit items-center rounded-full px-6 font-bold">{t("home.playDomino")}</span>
        </div>
      </Link>

      <div className="animate-rise grid grid-cols-2 gap-3" style={{ animationDelay: "120ms" }}>
        <button
          type="button"
          onClick={() => void playSolo()}
          disabled={solo}
          className="cafe-card flex min-h-20 flex-col items-start justify-center gap-1 px-4 py-3 text-start font-semibold transition-transform duration-150 active:scale-[0.97] disabled:opacity-60"
        >
          <BotIcon className="size-6 text-gold-light" />
          <span className="text-sm leading-tight">{solo ? t("play.soloStarting") : t("home.soloQuick")}</span>
        </button>
        <Link
          href="/play#join"
          className="cafe-card flex min-h-20 flex-col items-start justify-center gap-1 px-4 py-3 font-semibold transition-transform duration-150 active:scale-[0.97]"
        >
          <span className="font-mono text-base leading-6 font-bold tracking-[0.2em] text-gold-light" dir="ltr">
            ABCD
          </span>
          <span className="text-sm leading-tight">{t("home.joinCode")}</span>
        </Link>
      </div>

      {/* Les amis du café : qui est là, et les derniers messages. */}
      <section className="animate-rise flex flex-col gap-3" style={{ animationDelay: "180ms" }}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title flex-1">{t("home.friendsOnline")}</h2>
          <Link href="/friends?tab=friends" className="min-h-touch content-center text-sm font-semibold text-gold-light">
            {t("home.seeAll")}
          </Link>
        </div>
        {online.length === 0 ? (
          <div className="cafe-card flex items-center gap-3 p-4">
            <p className="flex-1 text-sm text-ink-muted">{t("home.noFriendsOnline")}</p>
            <Link href="/friends?tab=friends" className="gold-button flex min-h-touch shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold">
              <AddFriendIcon className="size-5" />
              {t("home.findFriends")}
            </Link>
          </div>
        ) : (
          <ul className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
            {online.map((f) => (
              <li key={f.id}>
                <Link href="/friends?tab=friends" className="flex w-16 flex-col items-center gap-1 text-center">
                  <PersonAvatar id={f.id} size={56} presence={presenceOf(f.id)} />
                  <span className="w-full truncate text-xs font-semibold">{f.username}</span>
                  <span className="w-full truncate text-[10px] text-ink-muted">{t(presenceKey(presenceOf(f.id)))}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {recent.length > 0 && (
          <>
            <h2 className="section-title mt-2">{t("home.messages")}</h2>
            <ul className="cafe-card flex flex-col divide-y divide-gold/10 overflow-hidden">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link href={`/friends/${c.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2.5 active:bg-white/5">
                    {c.kind === "group" ? <GroupAvatar members={c.members} size={40} /> : c.otherId && <PersonAvatar id={c.otherId} size={40} presence={presenceOf(c.otherId)} />}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={`truncate text-sm ${c.unread ? "font-bold" : "font-semibold"}`}>{conversationName(c)}</span>
                      <span className={`truncate text-xs ${c.unread ? "text-ink" : "text-ink-muted"}`}>{lastPreview(c, t)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] text-ink-muted">{shortTime(c.lastAt, locale, t)}</span>
                      {c.unread > 0 ? (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-cafe-0">{c.unread}</span>
                      ) : (
                        <ChatIcon className="size-4 text-gold/50" />
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* État des serveurs, en une ligne discrète. */}
      <p className="flex items-center justify-center gap-2 text-xs text-ink-muted" role="status">
        <span className={`size-2 rounded-full ${healthy === null ? "bg-cafe-muted/50" : healthy ? "bg-online shadow-[0_0_6px_var(--icos-online)]" : "bg-danger"}`} aria-hidden="true" />
        {t("home.status")} :{" "}
        {healthy === null ? t("home.statusChecking") : healthy ? t("home.statusOk") : t("home.statusDown")}
      </p>
    </div>
  );
}
