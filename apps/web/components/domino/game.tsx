"use client";

import { type End, type TileId, playableEnds, teamOf } from "@icosium/shared";
import type { MessageKey } from "@icosium/i18n";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MicButton } from "@/components/mic-button";
import { useI18n } from "@/lib/i18n";
import { playClack, playYourTurn } from "@/lib/sound";
import type { DominoView, SeatInfo } from "@/lib/domino-client";
import { DominoChain } from "./chain";
import { DominoHand } from "./hand";
import { SeatChip } from "./seat-chip";
import { SoundToggle } from "./sound-toggle";
import { DominoTile } from "./tile";

type Props = {
  code: string;
  view: DominoView;
  seats: SeatInfo[];
  mySeat: number;
  hand: TileId[];
  clockOffset: number;
  play: (tile: TileId, end: End) => Promise<{ ok: boolean; error?: string }>;
  tick: () => Promise<void>;
  nextRound: () => Promise<void>;
};

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

const ERROR_KEYS: Record<string, MessageKey> = {
  not_your_turn: "domino.error.not_your_turn",
  illegal_move: "domino.error.illegal_move",
  conflict: "domino.error.conflict",
  not_seated: "domino.error.not_seated",
};

/** L'écran de jeu : la table au centre, les autres autour, ma main et le micro en bas. */
export function DominoGame({ code, view, seats, mySeat, hand, clockOffset, play, tick, nextRound }: Props) {
  const { t } = useI18n();
  const players = view.options.players;
  const now = useNow(250);
  const serverNow = now + clockOffset;
  const [selected, setSelected] = useState<TileId | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [bubbles, setBubbles] = useState<Record<number, string>>({});
  const [freshTile, setFreshTile] = useState<string | null>(null);
  const [showScores, setShowScores] = useState(false);

  const nameOf = (seat: number) => seats.find((s) => s.seat === seat)?.username ?? null;
  const myTurn = view.phase === "playing" && view.turn === mySeat;

  // Coups possibles pour moi (le serveur revérifie tout).
  const moves = useMemo(
    () => (myTurn ? hand.flatMap((tile) => playableEnds(tile, view.chain, view.mustOpenWith).map((end) => ({ tile, end }))) : []),
    [myTurn, view.chain, view.mustOpenWith, hand],
  );
  const playable = useMemo(() => new Set(moves.map((m) => m.tile)), [moves]);
  const targets = selected ? playableEnds(selected, view.chain, view.mustOpenWith) : [];

  // Sons, animations et bulles à chaque nouvel événement de la table.
  const lastSeq = useRef(view.eventSeq);
  useEffect(() => {
    if (view.eventSeq === lastSeq.current) return;
    lastSeq.current = view.eventSeq;
    const next: Record<number, string> = {};
    for (const e of view.events) {
      if (e.type === "play") {
        playClack(e.closing);
        setFreshTile(e.tile);
      } else if (e.type === "pass") next[e.seat] = t("domino.pass");
      else if (e.type === "draw") next[e.seat] = t("domino.drew", { n: e.count });
    }
    if (Object.keys(next).length) {
      setBubbles(next);
      window.setTimeout(() => setBubbles({}), 2600);
    }
    if (view.phase === "playing" && view.turn === mySeat) playYourTurn();
    setSelected(null);
  }, [view.eventSeq, view.events, view.phase, view.turn, mySeat, t]);

  // Chrono écoulé : on prévient le serveur, qui vérifie l'heure et joue à la place du joueur.
  const remainingMs = view.deadline === null ? null : view.deadline - serverNow;
  const tickedFor = useRef<string>("");
  useEffect(() => {
    if (remainingMs === null || remainingMs > -800 || view.phase === "gameOver") return;
    const key = `${view.eventSeq}-${Math.floor(-remainingMs / 4000)}`;
    if (tickedFor.current === key) return;
    tickedFor.current = key;
    void tick();
  }, [remainingMs, view.eventSeq, view.phase, tick]);

  async function doPlay(tile: TileId, end: End) {
    setPending(true);
    setError(null);
    const res = await play(tile, end);
    setPending(false);
    setSelected(null);
    if (!res.ok) setError(ERROR_KEYS[res.error ?? ""] ?? "domino.error.unknown");
  }

  function onTapTile(tile: TileId) {
    setError(null);
    if (!myTurn) {
      setError("domino.notYourTurn");
      return;
    }
    if (!playable.has(tile)) {
      setError("domino.error.illegal_move");
      return;
    }
    const ends = playableEnds(tile, view.chain, view.mustOpenWith);
    const first = view.chain[0];
    const sameEnds = first !== undefined && view.chain[view.chain.length - 1]?.right === first.left;
    if (ends.length === 1 || sameEnds) void doPlay(tile, ends[ends.length - 1] as End);
    else setSelected(selected === tile ? null : tile);
  }

  // Les autres joueurs, placés comme autour d'une vraie table.
  const around =
    players === 4
      ? [
          { seat: (mySeat + 3) % 4, pos: "left" },
          { seat: (mySeat + 2) % 4, pos: "top" },
          { seat: (mySeat + 1) % 4, pos: "right" },
        ]
      : [{ seat: (mySeat + 1) % 2, pos: "top" }];
  const turnSeconds = view.options.turnSeconds;
  const fraction = remainingMs === null || turnSeconds === 0 ? null : remainingMs / (turnSeconds * 1000);

  const myTeam = teamOf(mySeat);
  const usScore = view.scores[myTeam];
  const themScore = view.scores[myTeam === 0 ? 1 : 0];

  const status = myTurn
    ? view.mustOpenWith
      ? t("domino.mustOpen", { tile: view.mustOpenWith })
      : selected
        ? t("domino.pickEnd")
        : t("domino.yourTurn")
    : view.phase === "playing"
      ? t("domino.theirTurn", { name: nameOf(view.turn) ?? "…" })
      : "";

  return (
    <div className="flex h-[calc(100dvh-var(--voicebar,0px))] flex-col">
      {/* En-tête : code, scores, son */}
      <header className="flex items-center gap-2 px-3 pt-2">
        <Link href="/play" className="min-h-touch flex items-center rounded-control px-2 text-sm font-semibold tracking-[0.2em] text-ink-muted">
          {code}
        </Link>
        <button
          type="button"
          onClick={() => setShowScores(true)}
          className="mx-auto flex min-h-touch items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold shadow-sm"
          aria-label={t("domino.scores")}
        >
          <span className="text-mint">{t("domino.us")} {usScore}</span>
          <span className="text-ink-muted">·</span>
          <span>{t("domino.them")} {themScore}</span>
          <span className="text-xs font-normal text-ink-muted">{t("domino.scoreTo", { n: view.options.targetScore })}</span>
        </button>
        <SoundToggle />
      </header>

      {/* Les autres joueurs */}
      <div className={`grid gap-2 px-3 pt-2 ${players === 4 ? "grid-cols-3" : "grid-cols-1"}`}>
        {around.map(({ seat, pos }) => (
          <SeatChip
            key={pos}
            name={nameOf(seat)}
            count={view.handCounts[seat] ?? 0}
            active={view.phase === "playing" && view.turn === seat}
            timeLeft={view.turn === seat ? fraction : null}
            bubble={bubbles[seat] ?? null}
            partner={players === 4 && pos === "top"}
          />
        ))}
      </div>

      {/* La table */}
      <main className="relative mx-3 mt-2 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[1.75rem] p-3 table-wood">
        {view.chain.length === 0 && !selected ? (
          <p className="text-center text-sm font-medium text-white/80">{t("domino.round", { n: view.round })}</p>
        ) : (
          <DominoChain chain={view.chain} targets={targets} onPick={(end) => selected && void doPlay(selected, end)} pickLabel={t("domino.playHere")} freshTile={freshTile} />
        )}
        {players === 2 && (
          <span className="absolute bottom-2 end-3 rounded-full bg-black/25 px-2 py-0.5 text-xs text-white/85">
            {t("domino.boneyard", { n: view.boneyardCount })}
          </span>
        )}
      </main>

      {/* Mon tour, ma main, mon micro */}
      <section className="px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex min-h-7 items-center justify-center gap-2 text-sm" aria-live="polite">
          {myTurn && fraction !== null && (
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
              <span className="block h-full rounded-full bg-mint transition-[width] duration-300 ease-linear" style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }} />
            </span>
          )}
          <span className={myTurn ? "font-semibold text-mint" : "text-ink-muted"}>{error ? t(error) : status}</span>
        </div>
        <DominoHand tiles={hand} playable={playable} selected={selected} myTurn={myTurn} pending={pending} onTap={onTapTile} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-ink-muted">{t("domino.round", { n: view.round })}</span>
          <MicButton size="small" />
        </div>
      </section>

      {(view.phase === "roundOver" || view.phase === "gameOver") && view.lastResult && (
        <RoundSheet view={view} seats={seats} mySeat={mySeat} serverNow={serverNow} onNext={nextRound} />
      )}
      {showScores && <ScoresSheet view={view} seats={seats} mySeat={mySeat} onClose={() => setShowScores(false)} />}
    </div>
  );
}

function teamNames(seats: SeatInfo[], team: number, players: number) {
  return seats
    .filter((s) => (players === 2 ? s.seat === team : teamOf(s.seat) === team))
    .map((s) => s.username)
    .join(" & ");
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 animate-fade" onClick={onClose}>
      <div
        className="animate-sheet w-full max-w-xl rounded-t-[1.75rem] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function RoundSheet({ view, seats, mySeat, serverNow, onNext }: { view: DominoView; seats: SeatInfo[]; mySeat: number; serverNow: number; onNext: () => Promise<void> }) {
  const { t } = useI18n();
  const r = view.lastResult;
  if (!r) return null;
  const players = view.options.players;
  const myTeam = teamOf(mySeat);
  const nameOf = (seat: number) => seats.find((s) => s.seat === seat)?.username ?? "…";
  const title =
    r.reason === "closed" && r.closedBy !== null
      ? t("domino.roundClosed", { name: r.closedBy === mySeat ? t("domino.you") : nameOf(r.closedBy) })
      : r.winnerTeam === null
        ? t("domino.roundDraw")
        : t("domino.roundBlocked");
  const secondsLeft = view.deadline === null ? null : Math.max(0, Math.ceil((view.deadline - serverNow) / 1000));
  const gameOver = view.phase === "gameOver";
  const won = gameOver && view.winnerTeam === myTeam;

  return (
    <Sheet>
      {gameOver ? (
        <div className="mb-4 flex flex-col items-center gap-1 text-center">
          <span className={`animate-pop text-4xl ${won ? "" : "grayscale"}`} aria-hidden="true">
            {won ? "🏆" : "🫖"}
          </span>
          <h2 className="text-2xl font-semibold">{won ? t("domino.gameOverWin") : t("domino.gameOverLose")}</h2>
          {view.winnerTeam !== null && <p className="text-ink-muted">{t("domino.gameOverTeam", { names: teamNames(seats, view.winnerTeam, players) })}</p>}
        </div>
      ) : (
        <div className="mb-3 text-center">
          <p className="text-sm text-ink-muted">{t("domino.round", { n: r.round })}</p>
          <h2 className="text-xl font-semibold">{title}</h2>
          {r.winnerTeam !== null && (
            <p className={`animate-pop mt-1 text-lg font-semibold ${r.winnerTeam === myTeam ? "text-mint" : "text-danger"}`}>{t("domino.points", { n: r.points })}</p>
          )}
        </div>
      )}

      <div className="mb-4 flex justify-center gap-6 text-center">
        <div>
          <p className="text-xs text-ink-muted">{t("domino.us")}</p>
          <p className="text-3xl font-semibold text-mint">{view.scores[myTeam]}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t("domino.them")}</p>
          <p className="text-3xl font-semibold">{view.scores[myTeam === 0 ? 1 : 0]}</p>
        </div>
      </div>

      <p className="mb-2 text-xs font-semibold text-ink-muted">{t("domino.remaining")}</p>
      <ul className="mb-5 flex flex-col gap-2">
        {r.hands.map((tiles, seat) => (
          <li key={seat} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate text-sm">{seat === mySeat ? t("domino.you") : nameOf(seat)}</span>
            <span dir="ltr" className="flex flex-1 flex-wrap gap-1">
              {tiles.map((tile) => {
                const [a, b] = tile.split("-").map(Number) as [number, number];
                return <DominoTile key={tile} a={a} b={b} orientation="horizontal" size={14} />;
              })}
            </span>
            <span className="w-8 text-end text-sm font-semibold">{r.handValues[seat]}</span>
          </li>
        ))}
      </ul>

      {gameOver ? (
        <Link href="/" className="flex min-h-14 items-center justify-center rounded-card bg-mint text-lg font-semibold text-mint-ink">
          {t("domino.backHome")}
        </Link>
      ) : (
        <button type="button" onClick={() => void onNext()} className="flex min-h-14 w-full items-center justify-center rounded-card bg-mint text-lg font-semibold text-mint-ink transition-transform duration-150 active:scale-[0.98]">
          {secondsLeft !== null ? t("domino.nextRoundIn", { n: secondsLeft }) : t("domino.nextRound")}
        </button>
      )}
    </Sheet>
  );
}

function ScoresSheet({ view, seats, mySeat, onClose }: { view: DominoView; seats: SeatInfo[]; mySeat: number; onClose: () => void }) {
  const { t } = useI18n();
  const players = view.options.players;
  const myTeam = teamOf(mySeat);
  const teams = [myTeam, myTeam === 0 ? 1 : 0] as const;
  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-1 text-xl font-semibold">{t("domino.scores")}</h2>
      <p className="mb-4 text-sm text-ink-muted">
        {t("domino.round", { n: view.round })} · {t("domino.scoreTo", { n: view.options.targetScore })}
      </p>
      <ul className="mb-5 flex flex-col gap-3">
        {teams.map((team, i) => {
          const score = view.scores[team];
          return (
            <li key={team} className="rounded-control bg-surface-2 p-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {i === 0 ? t("domino.us") : t("domino.them")} · {teamNames(seats, team, players)}
                </span>
                <span className={`text-2xl font-semibold ${i === 0 ? "text-mint" : ""}`}>{score}</span>
              </div>
              <span className="block h-2 overflow-hidden rounded-full bg-line">
                <span className={`block h-full rounded-full ${i === 0 ? "bg-mint" : "bg-ink-muted"}`} style={{ width: `${Math.min(100, (score / view.options.targetScore) * 100)}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={onClose} className="min-h-touch w-full rounded-control border border-line font-medium">
        {t("domino.close")}
      </button>
    </Sheet>
  );
}
