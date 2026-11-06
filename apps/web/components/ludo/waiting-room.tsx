"use client";

import type { LudoOptions } from "@icosium/shared";
import Link from "next/link";
import { useState } from "react";
import { CallSomeone, VisibilityPicker, useLeave } from "@/components/lobby/table-tools";
import { PersonActions } from "@/components/social/person-actions";
import { kickFromTable } from "@/lib/lobby";
import { useSocial } from "@/lib/social-context";
import { MicButton } from "@/components/mic-button";
import { SoundToggle } from "@/components/domino/sound-toggle";
import { tableAvatars } from "@/components/domino/player-badge";
import { BotIcon, CrownIcon, Emblem } from "@/components/cafe-icons";
import { type CallResult, type SeatInfo, seatKey } from "@/lib/domino-client";
import { useT } from "@/lib/i18n";
import { colorsFor } from "@icosium/shared";
import { LUDO_FILL, PawnArt } from "./board";

type Props = {
  code: string;
  tableId: string;
  hostId: string;
  options: LudoOptions;
  seats: SeatInfo[];
  mySeat: number;
  isHost: boolean;
  addBots: () => Promise<CallResult>;
};

/** Un petit pion de la couleur de la chaise (dessiné en SVG, comme sur le plateau). */
function MiniPawn({ color }: { color: ReturnType<typeof colorsFor>[number] }) {
  return (
    <svg viewBox="-14 -20 28 34" className="size-7" aria-hidden="true">
      <defs>
        <linearGradient id="lb-brass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6b4e1f" />
          <stop offset=".3" stopColor="#f6e2a8" />
          <stop offset=".55" stopColor="#c79f4f" />
          <stop offset="1" stopColor="#5e4219" />
        </linearGradient>
        <radialGradient id={`lb-enamel-${color}`} cx=".34" cy=".3" r=".8">
          <stop offset="0" stopColor="#fff" stopOpacity=".9" />
          <stop offset=".18" style={{ stopColor: LUDO_FILL[color].main }} />
          <stop offset=".85" style={{ stopColor: LUDO_FILL[color].dark }} />
        </radialGradient>
        <filter id="lb-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.4" floodColor="#1a0f08" floodOpacity=".55" />
        </filter>
      </defs>
      <PawnArt color={color} />
    </svg>
  );
}

/** En attendant les amis : le code en grand, partager, inviter, et les quatre coins du plateau qui se remplissent. */
export function LudoWaitingRoom({ code, tableId, hostId, options, seats, mySeat, isHost, addBots, onSeatsChanged }: Props & { onSeatsChanged?: () => void }) {
  const t = useT();
  const [botsBusy, setBotsBusy] = useState(false);
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null);
  const { friends } = useSocial();
  const { leave, leaving } = useLeave("ludo", tableId);
  const players = options.players;
  const colors = colorsFor(players);
  const avatars = tableAvatars(seats.map((s) => ({ key: seatKey(s), botName: s.userId ? null : s.username })));

  async function fillBots() {
    setBotsBusy(true);
    const res = await addBots();
    if (!res.ok) setBotsBusy(false);
  }

  // Les quatre coins, dans l'ordre de l'écran (haut-gauche, haut-droite, bas-gauche, bas-droite).
  const order = [0, 1, 3, 2];

  return (
    <div className="ludo-bg fixed inset-x-0 bottom-0 overflow-y-auto text-cafe-text" style={{ top: "var(--voicebar, 0px)" }}>
      <div className="mx-auto flex min-h-full max-w-xl flex-col px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between">
          <button type="button" onClick={() => void leave()} disabled={leaving} className="flex min-h-touch items-center gap-2 rounded-control pe-2 text-sm text-cafe-muted disabled:opacity-60">
            <Emblem className="size-9" />
            {leaving ? t("lobby.leaving") : t("ludo.leave")}
          </button>
          <SoundToggle tone="cafe" />
        </header>

        <section className="flex flex-col items-center gap-3 pt-1 text-center">
          <p className="text-[13px] font-semibold tracking-[0.3em] text-gold uppercase">{t("ludo.name")}</p>
          <h1 className="text-sm font-medium tracking-wide text-cafe-muted uppercase">{t("play.code")}</h1>
          <div className="flex gap-2" dir="ltr">
            {code.split("").map((letter, i) => (
              <span key={i} className="animate-pop cafe-panel flex h-16 w-12 items-center justify-center rounded-control text-3xl font-bold" style={{ animationDelay: `${i * 50}ms` }}>
                <span className="text-gilded">{letter}</span>
              </span>
            ))}
          </div>
          <CallSomeone game="ludo" code={code} players={players} free={players - seats.length} />
          {isHost && <VisibilityPicker game="ludo" tableId={tableId} />}
        </section>

        <div className="grid flex-1 grid-cols-2 content-center gap-3 py-8">
          {order.map((corner) => {
            const color = (["red", "green", "yellow", "blue"] as const)[corner] as (typeof colors)[number];
            const seat = colors.indexOf(color);
            if (seat < 0) return <div key={corner} className="h-28 rounded-card border border-dashed border-gold/10" aria-hidden="true" />;
            const who = seats.find((s) => s.seat === seat);
            const partner = options.teams && seat !== mySeat && seat % 2 === mySeat % 2;
            const fill = LUDO_FILL[color];
            const other = who?.userId && seat !== mySeat ? { id: who.userId, name: who.username } : null;
            return (
              <div
                key={corner}
                {...(other
                  ? {
                      role: "button",
                      tabIndex: 0,
                      "aria-label": t("domino.playerMenu", { name: other.name }),
                      onClick: () => setPerson(other),
                      onKeyDown: (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && setPerson(other),
                    }
                  : {})}
                className={`relative flex h-28 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-card border ${who ? "border-gold/60" : "border-dashed border-gold/30"}`}
                style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${fill.main} ${who ? 38 : 14}%, rgb(22 14 9 / 0.9)), rgb(18 11 7 / 0.92))` }}
              >
                <span
                  key={who ? seatKey(who) : "free"}
                  className={`flex size-14 items-center justify-center overflow-hidden rounded-full border-2 ${who ? "animate-seat" : "bg-black/30"}`}
                  style={{ borderColor: fill.main, borderStyle: who ? "solid" : "dashed" }}
                >
                  {who ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatars[seatKey(who)]} alt="" className="size-full object-cover" />
                  ) : (
                    <MiniPawn color={color} />
                  )}
                </span>
                <span className="max-w-[90%] truncate rounded-full bg-black/40 px-2 text-xs">
                  {who ? (seat === mySeat ? t("ludo.you") : who.username) : t("ludo.freeSeat")}
                  {who && partner ? ` · ${t("ludo.partner")}` : ""}
                </span>
                {who?.isBot && <BotIcon className="absolute end-2 top-2 size-4 text-gold-light" />}
                {who?.userId === hostId && <CrownIcon className="absolute end-2 top-2 size-4 text-gold-light drop-shadow" />}
                <span className="absolute start-2 top-2 size-2.5 rounded-full" style={{ background: fill.main }} aria-hidden="true" />
              </div>
            );
          })}
        </div>

        <p className="mb-1 px-6 text-center text-sm text-cafe-text/90">{t("ludo.waiting.hint")}</p>
        <p className="mb-3 text-center text-sm text-cafe-muted">
          {options.teams ? t("ludo.waiting.teams") : t(players === 2 ? "play.players2" : players === 3 ? "play.players3" : "play.ludoPlayers4")} ·{" "}
          {t("ludo.waiting.pawnsToWin", { n: options.pawnsToWin })} · {options.turnSeconds ? t("play.seconds", { n: options.turnSeconds }) : t("play.unlimited")}
        </p>
        <div className="mb-4 flex flex-col items-center gap-2">
          {isHost && seats.length < players && (
            <>
              <button
                type="button"
                onClick={() => void fillBots()}
                disabled={botsBusy}
                className="cafe-panel flex min-h-touch items-center gap-2 rounded-full border-gold/60 px-5 text-sm font-semibold text-gold-light transition-transform duration-150 active:scale-[0.97] disabled:opacity-60"
              >
                <BotIcon className="size-5" />
                {botsBusy ? t("play.soloStarting") : t("ludo.waiting.fillBots")}
              </button>
              <p className="max-w-72 text-center text-xs text-cafe-muted">{t("ludo.waiting.fillBotsHint")}</p>
            </>
          )}
          <Link href="/ludo/learn" className="flex min-h-touch items-center gap-2 rounded-full px-4 text-sm font-semibold text-gold-light underline decoration-gold/40 underline-offset-4">
            {t("ludo.learn.button")}
          </Link>
        </div>
        <div className="flex justify-center">
          <MicButton tone="cafe" />
        </div>
      </div>
      {person && (
        <PersonActions
          id={person.id}
          name={person.name}
          isFriend={friends.some((f) => f.id === person.id && f.status === "accepted")}
          atTable
          onKick={isHost ? () => kickFromTable("ludo", tableId, person.id).then((ok) => (onSeatsChanged?.(), ok)) : undefined}
          onClose={() => setPerson(null)}
        />
      )}
    </div>
  );
}
