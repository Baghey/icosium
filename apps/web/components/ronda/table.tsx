"use client";

import type { RondaCard } from "@icosium/shared";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { BotIcon, Emblem } from "@/components/cafe-icons";
import { MicIcon, MicOffIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { CardBack, PlayingCard } from "./playing-card";

/** Un joueur autour de la table (adversaire ou partenaire). */
export type RondaSeatPanel = {
  name: string;
  avatar: string | null;
  active: boolean;
  /** Part du temps restant (1 → 0), ou null sans chrono. */
  timeLeft: number | null;
  inVoice: boolean;
  micOn: boolean;
  speaking: boolean;
  /** Cartes en main (dos visibles). */
  cards: number;
  bot: boolean;
  partner: boolean;
  bubble: string | null;
  onTap?: () => void;
};

/** Une carte sur le feutre : elle arrive (in), reste (still) ou part vers un tas (out). */
export type TableCardView = {
  card: RondaCard;
  phase: "in" | "still" | "out";
  /** D'où elle arrive / où elle part (px, par rapport à sa place). */
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  glow?: boolean;
};

export type HandCardView = { card: RondaCard; selected: boolean; glow: boolean; dealt: boolean; label: string };

export type RondaScreenProps = {
  leave: { href?: string; onClick?: () => void; label: string };
  tools: ReactNode;
  chip: { label: string; seconds: number | null; fraction: number | null; mine: boolean };
  /** Adversaires et partenaire, de gauche à droite (1 à 2 joueurs, 3 à 4 joueurs). */
  seats: (RondaSeatPanel | null)[];
  score: { us: number; them: number; target: number; usLabel: string; themLabel: string };
  round: string;
  deckCount: number;
  piles: { us: number; them: number };
  tableCards: TableCardView[];
  shout: { text: string; key: number; big?: boolean } | null;
  /** Panneau posé sur le feutre (annonces vérifiées, fin de manche). */
  overlay?: ReactNode;
  status: ReactNode;
  /** Rangée au-dessus de la main : annonces, ou le texte du moment. */
  actions?: ReactNode;
  hand: HandCardView[];
  onHandTap?: (card: RondaCard) => void;
  myBubble?: string | null;
  bottomStart: ReactNode;
  bottomCenter: ReactNode;
  bottomEnd?: ReactNode;
  children?: ReactNode;
};

/** Où sont les tas sur le feutre, pour y envoyer les cartes ramassées. */
export const PILE_TARGET = { us: { x: 120, y: 140 }, them: { x: 120, y: -140 } } as const;

function Chip({ chip }: { chip: RondaScreenProps["chip"] }) {
  const C = 2 * Math.PI * 8;
  return (
    <span
      className={`flex min-w-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors duration-200 ${chip.mine ? "border-gold-light text-gold-light shadow-[0_0_14px_rgb(216_167_72/0.35)]" : "border-gold/70 text-cafe-text"}`}
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
      {chip.seconds !== null && <b className="text-[#fff3d0] tabular-nums">{`00:${String(Math.min(99, chip.seconds)).padStart(2, "0")}`}</b>}
    </span>
  );
}

/** Un adversaire ou le partenaire : avatar cerclé (l'anneau se vide avec le chrono), micro, cartes en main. */
function Seat({ p, compact }: { p: RondaSeatPanel | null; compact: boolean }) {
  const t = useT();
  if (!p) return <div className="h-[4.6rem] flex-1" aria-hidden="true" />;
  const ring = p.timeLeft === null ? 100 : Math.max(0, Math.min(1, p.timeLeft)) * 100;
  const Tag = p.onTap ? "button" : "div";
  return (
    <Tag
      {...(p.onTap ? { type: "button" as const, onClick: p.onTap, "aria-label": t("domino.playerMenu", { name: p.name }) } : {})}
      className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 ${compact ? "max-w-[7.5rem]" : "max-w-[10rem]"}`}
    >
      <span className="relative">
        <span
          className={`block size-12 rounded-full p-[3px] transition-shadow duration-200 ${p.speaking ? "animate-speak" : p.active ? "animate-turn" : ""}`}
          style={{ background: `conic-gradient(var(--gold-light) ${ring}%, rgb(255 255 255 / 0.12) 0)` }}
        >
          <span className="block size-full overflow-hidden rounded-full bg-cafe-2">
            {p.avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.avatar} alt="" className="size-full object-cover" />
            )}
          </span>
        </span>
        {p.inVoice && (
          <span
            className={`absolute -end-1 -bottom-0.5 flex size-[1.2rem] items-center justify-center rounded-full border ${p.micOn ? "border-[#bff0d2] bg-mic-on text-white" : "border-gold bg-cafe-1 text-gold"}`}
            aria-label={p.micOn ? t("voice.micOn") : t("voice.micOff")}
          >
            {p.micOn ? <MicIcon className="size-2.5" /> : <MicOffIcon className="size-2.5" />}
          </span>
        )}
        {p.bot && (
          <span className="absolute -start-1 -bottom-0.5 flex size-[1.2rem] items-center justify-center rounded-full border border-gold/60 bg-cafe-1 text-gold-light">
            <BotIcon className="size-3" />
          </span>
        )}
        {p.bubble && (
          <span key={p.bubble} className="animate-bubble pointer-events-none absolute start-1/2 -top-3 z-20 -translate-x-1/2 rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-cafe-0 shadow-lg rtl:translate-x-1/2">
            {p.bubble}
          </span>
        )}
      </span>
      <span className="flex w-full min-w-0 items-center justify-center gap-1 rounded-full border border-gold/45 bg-black/45 px-2 py-0.5">
        <span className="truncate text-[12px] font-semibold text-gold-light">{p.name}</span>
        <span className="flex shrink-0 items-center" aria-label={t("ronda.cards", { n: p.cards })}>
          {Array.from({ length: p.cards }, (_, i) => (
            <span key={i} className="-ms-1.5 first:ms-0" style={{ transform: `rotate(${(i - (p.cards - 1) / 2) * 9}deg)` }}>
              <CardBack width={11} />
            </span>
          ))}
        </span>
      </span>
      {p.partner && <span className="text-[10px] leading-none text-cafe-muted">{t("ronda.partner")}</span>}
    </Tag>
  );
}

/** Un tas de cartes ramassées : quelques dos décalés et le nombre. */
function Pile({ count, label, place }: { count: number; label: string; place: "top" | "bottom" }) {
  const shown = Math.min(4, Math.ceil(count / 4));
  return (
    <div className={`absolute end-2.5 flex flex-col items-center gap-0.5 ${place === "top" ? "top-11" : "bottom-2.5"}`} aria-label={`${label} : ${count}`}>
      {place === "bottom" && <span className="text-[10px] font-semibold tracking-wider text-gold-light/90 uppercase">{label}</span>}
      <span className="relative h-[46px] w-8">
        {count === 0 ? (
          <span className="absolute inset-0 rounded-[3px] border border-dashed border-gold/35" />
        ) : (
          Array.from({ length: shown }, (_, i) => (
            <span key={i} className="absolute start-0 top-0" style={{ transform: `translate(${i * 1.5}px, ${-i * 1.5}px) rotate(${(i % 2 ? 1 : -1) * (3 + i)}deg)` }}>
              <CardBack width={32} />
            </span>
          ))
        )}
        <span className="absolute -end-2 -bottom-1.5 min-w-5 rounded-full border border-gold/70 bg-cafe-0/90 px-1 text-center text-[11px] font-bold text-gold-light tabular-nums">{count}</span>
      </span>
      {place === "top" && <span className="text-[10px] font-semibold tracking-wider text-gold-light/90 uppercase">{label}</span>}
    </div>
  );
}

/**
 * L'écran de la Ronda, commun à la vraie partie et à la partie guidée : le café de nuit, les
 * adversaires en haut, la table en feutre vert au rebord de noyer (les cartes visibles, la pioche,
 * les tas), ta main en éventail en bas, et le gros micro sous le pouce.
 */
export function RondaScreen(props: RondaScreenProps) {
  const t = useT();
  const { leave, tools, chip, seats, score, tableCards, shout, hand } = props;
  const n = tableCards.length;
  const cardW = n <= 5 ? 58 : n <= 8 ? 52 : 46;

  const leaveEl = leave.href ? (
    <Link href={leave.href} className="flex min-h-touch shrink-0 items-center gap-1.5 rounded-control pe-1 text-gold" aria-label={leave.label}>
      <Emblem className="size-8" />
      <span className="text-[13px] font-semibold tracking-[0.28em] uppercase [text-shadow:0_1px_0_#000]">{t("ronda.name")}</span>
    </Link>
  ) : (
    <button type="button" onClick={leave.onClick} className="flex min-h-touch shrink-0 items-center gap-1.5 rounded-control pe-1 text-gold">
      <Emblem className="size-8" />
      <span className="text-sm font-semibold">{leave.label}</span>
    </button>
  );

  return (
    <div className="ludo-bg ronda-motion fixed inset-x-0 bottom-0 overflow-hidden text-cafe-text" style={{ top: "var(--voicebar, 0px)" }}>
      <div className="mx-auto flex h-full max-w-xl flex-col gap-1.5 px-2 pt-[max(0.25rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-2 ps-1">
          {leaveEl}
          <div className="flex min-w-0 items-center gap-1">{tools}</div>
        </header>
        <div className="flex justify-center">
          <Chip chip={chip} />
        </div>

        <div className="flex items-start justify-center gap-2 px-1">
          {seats.map((p, i) => (
            <Seat key={i} p={p} compact={seats.length > 1} />
          ))}
        </div>

        {/* La table : feutre émeraude, rebord en noyer, filet doré, rosace discrète. */}
        <section aria-label={t("ronda.table")} className="felt-table felt-grain relative min-h-0 flex-1 overflow-hidden rounded-[2rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/rosette.webp" alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 m-auto w-[62%] max-w-64 opacity-[0.13]" />

          <div className="absolute inset-x-0 top-2 flex justify-center">
            <span className="flex items-center gap-2 rounded-full border border-gold/50 bg-black/45 px-3 py-1 text-xs shadow-[inset_0_1px_0_rgb(255_230_170/0.12)]">
              <span className="text-cafe-muted">{score.usLabel}</span>
              <b className="text-gilded text-base leading-none tabular-nums">{score.us}</b>
              <span className="text-gold/50">·</span>
              <b className="text-base leading-none text-cafe-text/90 tabular-nums">{score.them}</b>
              <span className="text-cafe-muted">{score.themLabel}</span>
              <span className="ms-1 border-s border-gold/30 ps-2 text-[10px] text-gold-light/80">{t("ronda.toWin", { n: score.target })}</span>
            </span>
          </div>
          <span className="absolute start-3 top-2.5 text-[10px] font-semibold tracking-wider text-gold-light/60 uppercase">{props.round}</span>

          <div className="absolute inset-x-11 top-11 bottom-14 flex flex-wrap content-center items-center justify-center gap-x-1.5 gap-y-2">
            {tableCards.map((c, i) => {
              const style = {
                "--fx": `${c.from?.x ?? 0}px`,
                "--fy": `${c.from?.y ?? 140}px`,
                "--fr": `${(i % 2 ? 1 : -1) * 14}deg`,
                "--tx": `${c.to?.x ?? 0}px`,
                "--ty": `${c.to?.y ?? 0}px`,
                transform: `rotate(${((c.card.charCodeAt(0) * 7 + c.card.charCodeAt(1) * 3) % 7) - 3}deg)`,
              } as CSSProperties;
              return (
                <span key={c.card} className={c.phase === "in" ? "animate-card-in" : c.phase === "out" ? "animate-card-out" : ""} style={style}>
                  <PlayingCard card={c.card} width={cardW} glow={c.glow} label={c.card} />
                </span>
              );
            })}
          </div>

          {/* La pioche, en bas à gauche. */}
          <div className="absolute start-2.5 bottom-2.5 flex items-end gap-1.5">
            <span className="relative h-[46px] w-8">
              {props.deckCount > 0 ? (
                [0, 1, 2].map((i) => (
                  <span key={i} className="absolute start-0 top-0" style={{ transform: `translate(${i}px, ${-i * 1.5}px)` }}>
                    <CardBack width={32} />
                  </span>
                ))
              ) : (
                <span className="absolute inset-0 rounded-[3px] border border-dashed border-gold/35" />
              )}
            </span>
            <span className="mb-0.5 text-[10px] font-semibold tracking-wider text-gold-light/80 uppercase tabular-nums">{t("ronda.deck", { n: props.deckCount })}</span>
          </div>

          <Pile count={props.piles.them} label={score.themLabel} place="top" />
          <Pile count={props.piles.us} label={score.usLabel} place="bottom" />

          {shout && (
            <div key={shout.key} className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <span
                className={`animate-shout text-gilded font-black tracking-wide drop-shadow-[0_4px_10px_rgb(0_0_0/0.8)] ${shout.big ? "text-6xl" : "text-5xl"}`}
                style={{ fontFamily: "Georgia, 'Times New Roman', serif", WebkitTextStroke: "1px rgb(60 35 10 / 0.6)" }}
              >
                {shout.text}
              </span>
            </div>
          )}
          {props.overlay}
        </section>

        <div className="flex min-h-11 items-center justify-center px-2">{props.actions ?? <p className="text-center text-[13px] text-[#e3cc96] italic" aria-live="polite">{props.status}</p>}</div>

        {/* Ma main : trois cartes en éventail, grandes, sous le pouce. */}
        <div className="relative flex h-[8.4rem] items-end justify-center">
          {props.myBubble && (
            <span key={props.myBubble} className="animate-bubble pointer-events-none absolute -top-2 z-20 rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-cafe-0 shadow-lg">
              {props.myBubble}
            </span>
          )}
          {hand.map((h, i) => {
            const mid = (hand.length - 1) / 2;
            const angle = (i - mid) * 9;
            return (
              <button
                key={h.card}
                type="button"
                onClick={() => props.onHandTap?.(h.card)}
                aria-label={h.label}
                aria-pressed={h.selected}
                className="relative -mx-2 origin-bottom transition-transform duration-200 ease-icos"
                style={{ transform: `rotate(${angle}deg) translateY(${Math.abs(i - mid) * 7 + (h.selected ? -20 : 0)}px)`, zIndex: h.selected ? 5 : i }}
              >
                <span className={`block ${h.dealt ? "animate-deal" : ""}`} style={{ animationDelay: `${i * 70}ms` }}>
                  <PlayingCard card={h.card} width={88} glow={h.glow || h.selected} />
                </span>
              </button>
            );
          })}
        </div>

        <nav className="flex items-center justify-between px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="flex w-20 justify-start">{props.bottomStart}</div>
          {props.bottomCenter}
          <div className="flex w-20 justify-end">{props.bottomEnd}</div>
        </nav>
      </div>
      {props.children}
    </div>
  );
}
