"use client";

import type { DominoOptions } from "@icosium/shared";
import { useState } from "react";
import { MicButton } from "@/components/mic-button";
import { useT } from "@/lib/i18n";
import { type CallResult, type SeatInfo, seatKey } from "@/lib/domino-client";
import { kickFromTable } from "@/lib/lobby";
import { SoundToggle } from "./sound-toggle";
import { BotIcon, CrownIcon, Emblem } from "@/components/cafe-icons";
import { CallSomeone, VisibilityPicker, useLeave } from "@/components/lobby/table-tools";
import { PersonActions } from "@/components/social/person-actions";
import { useSocial } from "@/lib/social-context";
import { tableAvatars } from "./player-badge";

type Props = {
  code: string;
  tableId: string;
  hostId: string;
  options: DominoOptions;
  seats: SeatInfo[];
  mySeat: number;
  isHost: boolean;
  addBots: () => Promise<CallResult>;
};

/** En attendant les amis : le code en grand, le bouton partager, et les chaises qui se remplissent. */
export function WaitingRoom({ code, tableId, hostId, options, seats, mySeat, isHost, addBots, onSeatsChanged }: Props & { onSeatsChanged?: () => void }) {
  const t = useT();
  const [botsBusy, setBotsBusy] = useState(false);
  const { leave, leaving } = useLeave("domino", tableId);
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null);
  const { friends } = useSocial();
  const players = options.players;
  const avatars = tableAvatars(seats.map((s) => ({ key: seatKey(s), botName: s.userId ? null : s.username })));

  async function fillBots() {
    setBotsBusy(true);
    const res = await addBots();
    if (!res.ok) setBotsBusy(false);
  }

  // Les chaises autour de la table, vues depuis ma place (moi en bas).
  const positions =
    players === 4
      ? [
          { seat: mySeat, cls: "bottom-0 start-1/2 -translate-x-1/2 translate-y-1/2 rtl:translate-x-1/2" },
          { seat: (mySeat + 1) % 4, cls: "end-0 top-1/2 translate-x-1/2 -translate-y-1/2 rtl:-translate-x-1/2" },
          { seat: (mySeat + 2) % 4, cls: "top-0 start-1/2 -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2" },
          { seat: (mySeat + 3) % 4, cls: "start-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2" },
        ]
      : [
          { seat: mySeat, cls: "bottom-0 start-1/2 -translate-x-1/2 translate-y-1/2 rtl:translate-x-1/2" },
          { seat: (mySeat + 1) % 2, cls: "top-0 start-1/2 -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2" },
        ];

  return (
    <div className="cafe-bg fixed inset-x-0 bottom-0 overflow-y-auto text-cafe-text" style={{ top: "var(--voicebar, 0px)" }}>
    <div className="mx-auto flex min-h-full max-w-xl flex-col px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <button type="button" onClick={() => void leave()} disabled={leaving} className="flex min-h-touch items-center gap-2 rounded-control pe-2 text-sm text-cafe-muted disabled:opacity-60">
          <Emblem className="size-9" />
          {leaving ? t("lobby.leaving") : t("domino.leave")}
        </button>
        <SoundToggle tone="cafe" />
      </header>

      <section className="flex flex-col items-center gap-3 pt-2 text-center">
        <h1 className="text-sm font-medium tracking-wide text-cafe-muted uppercase">{t("play.code")}</h1>
        <div className="flex gap-2" dir="ltr">
          {code.split("").map((letter, i) => (
            <span
              key={i}
              className="animate-pop cafe-panel flex h-16 w-12 items-center justify-center rounded-control text-3xl font-bold"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="text-gilded">{letter}</span>
            </span>
          ))}
        </div>
        <CallSomeone game="domino" code={code} players={players} free={players - seats.length} />
        {isHost && <VisibilityPicker game="domino" tableId={tableId} />}
      </section>

      <div className="flex flex-1 items-center justify-center py-12">
        <div className="table-photo relative aspect-[4/5] w-[min(16rem,66vw)]">
          {positions.map(({ seat, cls }) => {
            const who = seats.find((s) => s.seat === seat);
            const partner = players === 4 && seat === (mySeat + 2) % 4;
            const other = who?.userId && seat !== mySeat ? { id: who.userId, name: who.username } : null;
            return (
              <div
                key={seat}
                className={`absolute flex flex-col items-center gap-1 ${cls}`}
                {...(other
                  ? {
                      role: "button",
                      tabIndex: 0,
                      "aria-label": t("domino.playerMenu", { name: other.name }),
                      onClick: () => setPerson(other),
                      onKeyDown: (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && setPerson(other),
                    }
                  : {})}
              >
                <span
                  key={who ? seatKey(who) : "free"}
                  className={`flex size-14 items-center justify-center overflow-hidden rounded-full border-2 text-lg font-semibold ${
                    who ? "animate-seat border-gold bg-gradient-to-b from-cafe-2 to-cafe-0 shadow-[0_0_14px_rgba(216,167,72,0.45)]" : "border-dashed border-gold/40 bg-black/40 text-cafe-muted"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {who ? <img src={avatars[seatKey(who)]} alt="" className="size-full rounded-full object-cover" /> : "·"}
                </span>
                {who?.userId === hostId && <CrownIcon className="absolute -top-3 size-4 text-gold-light drop-shadow" />}
                <span className="cafe-panel max-w-28 truncate rounded-full px-2 text-xs">
                  {who ? (seat === mySeat ? t("domino.you") : who.username) : t("domino.freeSeat")}
                  {who && partner ? ` · ${t("domino.partner")}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {person && (
        <PersonActions
          id={person.id}
          name={person.name}
          isFriend={friends.some((f) => f.id === person.id && f.status === "accepted")}
          atTable
          onKick={isHost ? () => kickFromTable("domino", tableId, person.id).then((ok) => (onSeatsChanged?.(), ok)) : undefined}
          onClose={() => setPerson(null)}
        />
      )}
      <p className="mb-1 px-6 text-center text-sm text-cafe-text/90">{t("domino.waitingHint")}</p>
      <p className="mb-3 text-center text-sm text-cafe-muted">
        {players === 4 ? t("play.players4") : t("play.players2")} · {options.targetScore} ·{" "}
        {options.turnSeconds ? t("play.seconds", { n: options.turnSeconds }) : t("play.unlimited")}
      </p>
      {isHost && seats.length < players && (
        <div className="mb-4 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => void fillBots()}
            disabled={botsBusy}
            className="cafe-panel flex min-h-touch items-center gap-2 rounded-full border-gold/60 px-5 text-sm font-semibold text-gold-light transition-transform duration-150 active:scale-[0.97] disabled:opacity-60"
          >
            <BotIcon className="size-5" />
            {botsBusy ? t("play.soloStarting") : t("domino.fillBots")}
          </button>
          <p className="max-w-72 text-center text-xs text-cafe-muted">{t("domino.fillBotsHint")}</p>
        </div>
      )}
      <div className="flex justify-center">
        <MicButton tone="cafe" />
      </div>
    </div>
    </div>
  );
}
