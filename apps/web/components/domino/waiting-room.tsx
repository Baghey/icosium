"use client";

import type { DominoOptions } from "@icosium/shared";
import Link from "next/link";
import { useState } from "react";
import { MicButton } from "@/components/mic-button";
import { useT } from "@/lib/i18n";
import type { SeatInfo } from "@/lib/domino-client";
import { SoundToggle } from "./sound-toggle";

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
    <div className="mx-auto flex min-h-[calc(100dvh-var(--voicebar,0px))] max-w-xl flex-col px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <Link href="/play" className="flex min-h-touch items-center rounded-control px-2 text-sm text-ink-muted">
          {t("domino.leave")}
        </Link>
        <SoundToggle />
      </header>

      <section className="flex flex-col items-center gap-3 pt-2 text-center">
        <h1 className="text-lg font-semibold">{t("play.code")}</h1>
        <div className="flex gap-2" dir="ltr">
          {code.split("").map((letter, i) => (
            <span
              key={i}
              className="animate-pop flex h-16 w-12 items-center justify-center rounded-control border border-line bg-surface text-3xl font-semibold shadow-sm"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {letter}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void share()}
          className="min-h-touch rounded-full bg-mint-soft px-5 text-sm font-semibold text-mint transition-transform duration-150 active:scale-[0.97]"
        >
          {copied ? t("domino.copied") : t("domino.share")}
        </button>
      </section>

      <div className="flex flex-1 items-center justify-center py-12">
        <div className="table-wood relative aspect-square w-[min(15rem,62vw)] rounded-[2rem]">
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-medium text-white/85">
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
                    who ? "animate-seat border-mint bg-surface text-ink shadow-md" : "border-dashed border-line bg-surface-2 text-ink-muted"
                  }`}
                >
                  {who ? who.username.charAt(0).toUpperCase() : "·"}
                </span>
                <span className="max-w-28 truncate rounded-full bg-surface/90 px-2 text-xs">
                  {who ? (seat === mySeat ? t("domino.you") : who.username) : t("domino.freeSeat")}
                  {who && partner ? ` · ${t("domino.partner")}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mb-3 text-center text-sm text-ink-muted">
        {players === 4 ? t("play.players4") : t("play.players2")} · {options.targetScore} ·{" "}
        {options.turnSeconds ? t("play.seconds", { n: options.turnSeconds }) : t("play.unlimited")}
      </p>
      <div className="flex justify-center">
        <MicButton />
      </div>
    </div>
  );
}
