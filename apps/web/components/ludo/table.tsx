"use client";

import type { LudoColor } from "@icosium/shared";
import Link from "next/link";
import { type ReactNode, type RefObject, useEffect, useState } from "react";
import { Emblem } from "@/components/cafe-icons";
import { useT } from "@/lib/i18n";
import { type BoardPawn, LudoBoard } from "./board";
import { RollingDie } from "./die";
import { type LudoPlayer, PlayerPanel } from "./player-panel";

/** Téléphone tenu en largeur (peu de hauteur) : le plateau au centre, les joueurs sur les côtés. */
function useWideLayout(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape) and (max-height: 560px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

export type LudoScreenProps = {
  /** Joueurs par coin de l'écran : 0 haut-gauche, 1 haut-droite, 2 bas-droite, 3 bas-gauche. */
  corners: (LudoPlayer | null)[];
  quarter: number;
  active: LudoColor[];
  pawns: BoardPawn[];
  onPawn?: (seat: number, pawn: number) => void;
  onMiss?: (near: { seat: number; pawn: number } | null) => void;
  pawnLabel?: (p: BoardPawn) => string;
  /** Pastille du haut : « Tour de Yasmine » et le temps qui reste. */
  chip: { label: string; seconds: number | null; fraction: number | null; mine: boolean };
  status: ReactNode;
  /** Le gros dé du bas. */
  die: { value: number | null; rollKey: number; canRoll: boolean; onRoll: () => void; busy: boolean; onBlocked?: () => void };
  /** Lien ou bouton en haut à gauche (quitter la table, passer le tutoriel). */
  leave: { href?: string; onClick?: () => void; label: string };
  /** Boutons en haut à droite (règles, son). */
  tools: ReactNode;
  /** Bas à gauche et au centre (son, micro). */
  bottomStart: ReactNode;
  bottomCenter: ReactNode;
  boardRef?: RefObject<SVGSVGElement | null>;
  dieRef?: RefObject<HTMLButtonElement | null>;
  children?: ReactNode;
};

function Chip({ chip }: { chip: LudoScreenProps["chip"] }) {
  const C = 2 * Math.PI * 8;
  const secs = chip.seconds;
  return (
    <span
      className={`flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors duration-200 ${chip.mine ? "border-gold-light text-gold-light" : "border-gold/70 text-cafe-text"}`}
      style={{ background: "rgb(22 14 9 / 0.85)" }}
      aria-live="polite"
    >
      {chip.fraction !== null && (
        <svg viewBox="0 0 20 20" className="size-4 shrink-0" aria-hidden="true">
          <circle cx="10" cy="10" r="8" fill="none" stroke="rgb(217 180 106 / 0.3)" strokeWidth="3" />
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            stroke="var(--gold-light)"
            strokeWidth="3"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - Math.max(0, Math.min(1, chip.fraction)))}
            transform="rotate(-90 10 10)"
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-300 ease-linear"
          />
        </svg>
      )}
      <span className="truncate">{chip.label}</span>
      {secs !== null && <b className="text-[#fff3d0] tabular-nums">{`00:${String(Math.min(99, secs)).padStart(2, "0")}`}</b>}
    </span>
  );
}

function BigDie({ die, dieRef }: { die: LudoScreenProps["die"]; dieRef?: RefObject<HTMLButtonElement | null> }) {
  const t = useT();
  return (
    <button
      ref={dieRef}
      type="button"
      onClick={die.canRoll && !die.busy ? die.onRoll : die.onBlocked}
      disabled={!die.onBlocked && (!die.canRoll || die.busy)}
      aria-label={t("ludo.rollLabel")}
      className={`relative flex size-[5.25rem] shrink-0 flex-col items-center justify-center rounded-[1.4rem] transition-transform duration-150 active:scale-95 ${die.canRoll ? "" : "opacity-70"}`}
      style={{ background: "radial-gradient(circle at 50% 40%, rgb(255 220 150 / 0.25), transparent 70%)" }}
    >
      {die.canRoll && <span className="animate-ring pointer-events-none absolute inset-2 rounded-[1.2rem]" aria-hidden="true" />}
      <RollingDie value={die.value} rollKey={die.rollKey} size={58} dim={!die.canRoll} />
      <span className={`mt-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase ${die.canRoll ? "text-gold-light" : "text-cafe-muted"}`}>{t("ludo.roll")}</span>
    </button>
  );
}

/**
 * L'écran du Ludo, commun à la vraie partie et à la partie guidée : nuit au café, joueurs aux
 * quatre coins, plateau au centre, gros micro et gros dé en bas (à portée de pouce).
 */
export function LudoScreen(props: LudoScreenProps) {
  const t = useT();
  const wide = useWideLayout();
  const { corners, chip, status, die, leave, tools, bottomStart, bottomCenter } = props;

  const leaveEl = leave.href ? (
    <Link href={leave.href} className="flex min-h-touch shrink-0 items-center gap-1.5 rounded-control pe-1 text-gold" aria-label={leave.label}>
      <Emblem className="size-8" />
      <span className="text-[13px] font-semibold tracking-[0.22em] uppercase [text-shadow:0_1px_0_#000]">{t("ludo.name")}</span>
    </Link>
  ) : (
    <button type="button" onClick={leave.onClick} className="flex min-h-touch shrink-0 items-center gap-1.5 rounded-control pe-1 text-gold">
      <Emblem className="size-8" />
      <span className="text-sm font-semibold">{leave.label}</span>
    </button>
  );

  const board = (
    <div className="flex min-h-0 flex-1 items-center justify-center" style={{ containerType: "size" }}>
      <div style={{ width: "min(100cqw, 100cqh)", height: "min(100cqw, 100cqh)" }}>
        <LudoBoard
          quarter={props.quarter}
          active={props.active}
          pawns={props.pawns}
          onPawn={props.onPawn}
          onMiss={props.onMiss}
          pawnLabel={props.pawnLabel}
          svgRef={props.boardRef}
          label={t("ludo.board")}
        />
      </div>
    </div>
  );

  const statusEl = (
    <p className="min-h-5 px-3 text-center text-[13px] text-[#e3cc96] italic" aria-live="polite">
      {status}
    </p>
  );

  return (
    <div className="ludo-bg fixed inset-x-0 bottom-0 overflow-hidden text-cafe-text" style={{ top: "var(--voicebar, 0px)" }}>
      {wide ? (
        <div className="flex h-full gap-2 px-[max(0.5rem,env(safe-area-inset-left))] py-2">
          <aside className="flex w-44 shrink-0 flex-col gap-2">
            <div className="flex items-center gap-1">{leaveEl}</div>
            <PlayerPanel p={corners[0] ?? null} align="start" />
            <div className="flex-1" />
            <PlayerPanel p={corners[3] ?? null} align="start" />
            <div className="flex items-center gap-2">{bottomStart}</div>
          </aside>
          <main className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <Chip chip={chip} />
            {board}
            {statusEl}
          </main>
          <aside className="flex w-44 shrink-0 flex-col gap-2 pe-[env(safe-area-inset-right)]">
            <div className="flex justify-end gap-1">{tools}</div>
            <PlayerPanel p={corners[1] ?? null} align="end" />
            <div className="flex flex-1 items-center justify-around">
              {bottomCenter}
              <BigDie die={die} dieRef={props.dieRef} />
            </div>
            <PlayerPanel p={corners[2] ?? null} align="end" />
          </aside>
        </div>
      ) : (
        <div className="mx-auto flex h-full max-w-xl flex-col gap-1.5 px-2 pt-[max(0.25rem,env(safe-area-inset-top))]">
          <header className="flex items-center justify-between gap-2 ps-1">
            {leaveEl}
            <div className="flex min-w-0 items-center gap-1">{tools}</div>
          </header>
          <div className="flex justify-center">
            <Chip chip={chip} />
          </div>
          <div className="flex gap-2">
            <PlayerPanel p={corners[0] ?? null} align="start" />
            <PlayerPanel p={corners[1] ?? null} align="end" />
          </div>
          {board}
          {statusEl}
          <div className="flex gap-2">
            <PlayerPanel p={corners[3] ?? null} align="start" />
            <PlayerPanel p={corners[2] ?? null} align="end" />
          </div>
          <nav className="flex items-center justify-between px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="flex w-[5.25rem] justify-start">{bottomStart}</div>
            {bottomCenter}
            <BigDie die={die} dieRef={props.dieRef} />
          </nav>
        </div>
      )}
      {props.children}
    </div>
  );
}
