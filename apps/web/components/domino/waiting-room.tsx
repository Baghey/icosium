"use client";

import type { DominoOptions } from "@icosium/shared";
import Link from "next/link";
import { useState } from "react";
import { MicButton } from "@/components/mic-button";
import { useT } from "@/lib/i18n";
import type { SeatInfo } from "@/lib/domino-client";
import { SoundToggle } from "./sound-toggle";
import { Emblem } from "@/components/cafe-icons";

type Props = { code: string; options: DominoOptions; seats: SeatInfo[]; mySeat: number };

/** En attendant les amis : le code en grand, le bouton partager, et les chaises qui se remplissent. */
export function WaitingRoom({ code, options, seats, mySeat }: Props) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const players = options.players;

  async function share() {
    const text = t("domino.shareText", { code });
    const url = `${window.location.origin}/play/${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        // l'utilisateur a fermé le partage : on copie à la place
      }
    }
    await navigator.clipboard?.writeText(`${text}\n${url}`).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
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
        <Link href="/play" className="flex min-h-touch items-center gap-2 rounded-control pe-2 text-sm text-cafe-muted">
          <Emblem className="size-9" />
          {t("domino.leave")}
        </Link>
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
        <button
          type="button"
          onClick={() => void share()}
          className="gold-button min-h-touch rounded-full px-6 text-sm font-bold transition-transform duration-150 active:scale-[0.97]"
        >
          {copied ? t("domino.copied") : t("domino.share")}
        </button>
      </section>

      <div className="flex flex-1 items-center justify-center py-12">
        <div className="felt-table relative aspect-square w-[min(15rem,62vw)] rounded-[2.5rem]">
          <p className="absolute inset-0 flex items-center justify-center px-16 text-center text-xs font-medium text-cafe-text/90">
            {t("domino.waitingHint")}
          </p>
          {positions.map(({ seat, cls }) => {
            const who = seats.find((s) => s.seat === seat);
            const partner = players === 4 && seat === (mySeat + 2) % 4;
            return (
              <div key={seat} className={`absolute flex flex-col items-center gap-1 ${cls}`}>
                <span
                  key={who?.userId ?? "free"}
                  className={`flex size-14 items-center justify-center rounded-full border-2 text-lg font-semibold ${
                    who ? "animate-seat border-gold bg-gradient-to-b from-cafe-2 to-cafe-0 shadow-[0_0_14px_rgba(216,167,72,0.45)]" : "border-dashed border-gold/40 bg-black/40 text-cafe-muted"
                  }`}
                >
                  {who ? <span className="text-gilded">{who.username.charAt(0).toUpperCase()}</span> : "·"}
                </span>
                <span className="cafe-panel max-w-28 truncate rounded-full px-2 text-xs">
                  {who ? (seat === mySeat ? t("domino.you") : who.username) : t("domino.freeSeat")}
                  {who && partner ? ` · ${t("domino.partner")}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mb-3 text-center text-sm text-cafe-muted">
        {players === 4 ? t("play.players4") : t("play.players2")} · {options.targetScore} ·{" "}
        {options.turnSeconds ? t("play.seconds", { n: options.turnSeconds }) : t("play.unlimited")}
      </p>
      <div className="flex justify-center">
        <MicButton tone="cafe" />
      </div>
    </div>
    </div>
  );
}
