"use client";

import { type LudoColor, type LudoEvent, targetStep } from "@icosium/shared";
import type { MessageKey } from "@icosium/i18n";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MicButton } from "@/components/mic-button";
import { Sheet } from "@/components/sheet";
import { SoundToggle } from "@/components/domino/sound-toggle";
import { tableAvatars } from "@/components/domino/player-badge";
import { CrownIcon } from "@/components/cafe-icons";
import { type CallResult, type SeatInfo, seatKey } from "@/lib/domino-client";
import { useT } from "@/lib/i18n";
import { quarterFor, screenCorner } from "@/lib/ludo-geometry";
import type { LudoView } from "@/lib/ludo-client";
import { playYourTurn, preloadSounds } from "@/lib/sound";
import { useLudoPlayback } from "@/lib/use-ludo-playback";
import { useVoice } from "@/lib/voice-context";
import type { BoardPawn } from "./board";
import type { LudoPlayer } from "./player-panel";
import { LudoRulesSheet, RulesButton } from "./rules-sheet";
import { LudoScreen } from "./table";

type Props = {
  code: string;
  view: LudoView;
  seats: SeatInfo[];
  mySeat: number;
  clockOffset: number;
  roll: () => Promise<CallResult>;
  move: (pawn: number) => Promise<CallResult>;
  tick: () => Promise<void>;
};

function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

const ERRORS: Record<string, MessageKey> = {
  not_your_turn: "ludo.error.not_your_turn",
  must_roll: "ludo.error.must_roll",
  must_move: "ludo.error.must_move",
  illegal_move: "ludo.error.illegal_move",
  conflict: "ludo.error.conflict",
};

export function LudoGame({ code, view, seats, mySeat, clockOffset, roll, move, tick }: Props) {
  const t = useT();
  const now = useNow(250);
  const serverNow = now + clockOffset;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [bubbles, setBubbles] = useState<Record<number, string>>({});
  const [showRules, setShowRules] = useState(false);
  const { peers } = useVoice();

  const nameOf = (seat: number) => (seat === mySeat ? t("ludo.you") : (seats.find((s) => s.seat === seat)?.username ?? "…"));

  // Les vrais sons se chargent au premier toucher (le navigateur exige un geste pour le son).
  useEffect(() => {
    const go = () => preloadSounds();
    window.addEventListener("pointerdown", go, { once: true });
    return () => window.removeEventListener("pointerdown", go);
  }, []);

  const bubbleTimer = useRef<number | null>(null);
  const say = (seat: number, text: string) => {
    setBubbles((b) => ({ ...b, [seat]: text }));
    if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubbles({}), 2400);
  };
  const onEvent = (e: LudoEvent) => {
    setError(null);
    if (e.type === "bonus") say(e.seat, t(e.reason === "six" ? "ludo.bubble.six" : "ludo.bubble.capture"));
    else if (e.type === "threeSixes") say(e.seat, t("ludo.bubble.threeSixes"));
    else if (e.type === "noMove") say(e.seat, t("ludo.bubble.noMove"));
    else if (e.type === "done") say(e.seat, t("ludo.bubble.done"));
  };
  const playback = useLudoPlayback(view, onEvent);
  const busy = playback.busy;

  const myColor = view.colors[mySeat] as LudoColor;
  const quarter = quarterFor(myColor);
  const players = view.colors.length;
  const myTurn = view.phase !== "over" && view.turn === mySeat;
  const canMove = myTurn && view.phase === "move" && !busy && !pending;
  const canRoll = myTurn && view.phase === "roll" && !busy && !pending;

  // « C'est à toi » : un petit carillon quand la main arrive (après les animations).
  const announced = useRef("");
  useEffect(() => {
    const key = `${view.eventSeq}`;
    if (canRoll && announced.current !== key && view.events.some((e) => e.type !== "roll" || e.seat !== mySeat)) {
      announced.current = key;
      playYourTurn();
    }
  }, [canRoll, view.eventSeq, view.events, mySeat]);

  // Chrono écoulé (ou tour d'un bot) : on prévient le serveur, qui vérifie l'heure et joue.
  const remainingMs = view.deadline === null ? null : view.deadline - serverNow;
  const botTurn = view.bots.includes(view.turn);
  const tickedFor = useRef("");
  useEffect(() => {
    const grace = botTurn ? -150 : -800;
    if (remainingMs === null || remainingMs > grace || view.phase === "over") return;
    const key = `${view.eventSeq}-${Math.floor(-remainingMs / 4000)}`;
    if (tickedFor.current === key) return;
    tickedFor.current = key;
    void tick();
  }, [remainingMs, view.eventSeq, view.phase, botTurn, tick]);

  async function doRoll() {
    if (!canRoll) return;
    setPending(true);
    setError(null);
    const res = await roll();
    setPending(false);
    if (!res.ok) setError(ERRORS[res.error] ?? "ludo.error.unknown");
  }

  async function doMove(seat: number, pawn: number) {
    if (!canMove || seat !== view.mover) return;
    setPending(true);
    setError(null);
    const res = await move(pawn);
    setPending(false);
    if (!res.ok) setError(ERRORS[res.error] ?? "ludo.error.unknown");
  }

  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(() => setError(null), 2600);
    return () => window.clearTimeout(id);
  }, [error]);

  const avatars = useMemo(() => tableAvatars(seats.map((s) => ({ key: seatKey(s), botName: s.userId ? null : s.username }))), [seats]);
  const turnSeconds = view.options.turnSeconds;
  const fraction = remainingMs === null || turnSeconds === 0 || botTurn ? null : Math.max(0, remainingMs / (turnSeconds * 1000));

  const corners: (LudoPlayer | null)[] = [null, null, null, null];
  view.colors.forEach((color, seat) => {
    const s = seats.find((x) => x.seat === seat);
    const peer = s?.userId ? peers.find((x) => x.identity === s.userId) : undefined;
    const active = view.phase !== "over" && view.turn === seat;
    corners[screenCorner(color, quarter)] = {
      name: nameOf(seat),
      color,
      avatar: s ? (avatars[seatKey(s)] ?? null) : null,
      active,
      timeLeft: active ? fraction : null,
      inVoice: Boolean(peer),
      micOn: Boolean(peer?.micOn),
      speaking: Boolean(peer?.isSpeaking && peer.micOn),
      finished: (playback.pawns[seat] ?? []).filter((p) => p === 56).length,
      pawnsToWin: view.options.pawnsToWin,
      die: seat === mySeat ? null : (playback.dice[seat] ?? null),
      bot: view.bots.includes(seat),
      partner: view.options.teams && seat !== mySeat && seat % 2 === mySeat % 2,
      bubble: bubbles[seat] ?? null,
    };
  });

  const pawns: BoardPawn[] = view.colors.flatMap((color, seat) =>
    (playback.pawns[seat] ?? []).map((step, pawn) => {
      const key = `${seat}:${pawn}`;
      const movable = canMove && view.mover === seat && view.movable.includes(pawn);
      return {
        key,
        seat,
        pawn,
        color,
        step,
        hops: playback.hops[key] ?? 0,
        returning: playback.returning.has(key),
        movable,
        target: movable && view.die ? targetStep(view.pawns[seat]?.[pawn] ?? -1, view.die) : null,
      };
    }),
  );

  const turnName = nameOf(view.turn);
  const secs = remainingMs === null || botTurn ? null : Math.max(0, Math.ceil(remainingMs / 1000));
  let status: string;
  if (error) status = t(error);
  else if (view.phase === "over") status = "";
  else if (busy) status = "";
  else if (myTurn)
    status =
      view.phase === "roll"
        ? view.mover !== mySeat
          ? t("ludo.status.forPartner")
          : t("ludo.status.yourRoll")
        : t("ludo.status.yourMove", { n: view.die ?? 0 });
  else status = view.phase === "roll" ? t("ludo.status.theirRoll", { name: turnName }) : t("ludo.status.theirMove", { name: turnName, n: view.die ?? 0 });

  const myDie = playback.dice[mySeat];

  return (
    <LudoScreen
      corners={corners}
      quarter={quarter}
      active={view.colors}
      pawns={pawns}
      onPawn={(seat, pawn) => void doMove(seat, pawn)}
      onMiss={(near) => {
        if (!myTurn || busy) return;
        if (view.phase === "roll") setError("ludo.error.must_roll");
        else if (near && near.seat === view.mover) setError("ludo.error.illegal_move");
      }}
      pawnLabel={(p) => t("ludo.pawn", { n: p.pawn + 1 })}
      chip={{ label: myTurn ? t("ludo.yourTurnChip") : t("ludo.turnOf", { name: turnName }), seconds: secs, fraction, mine: myTurn }}
      status={status}
      die={{ value: myDie?.value ?? null, rollKey: myDie?.key ?? 0, canRoll, onRoll: () => void doRoll(), busy: pending }}
      leave={{ href: "/play", label: t("ludo.leave") }}
      tools={
        <>
          <SoundToggle tone="cafe" />
          <RulesButton onClick={() => setShowRules(true)} />
        </>
      }
      bottomStart={<span className="text-[11px] font-semibold tracking-[0.2em] text-cafe-muted" dir="ltr">{code}</span>}
      bottomCenter={<MicButton tone="cafe" />}
    >
      {showRules && <LudoRulesSheet pawnsToWin={view.options.pawnsToWin} onClose={() => setShowRules(false)} learnHref="/ludo/learn" />}
      {view.phase === "over" && !busy && view.winners && <EndSheet view={view} mySeat={mySeat} nameOf={nameOf} players={players} />}
    </LudoScreen>
  );
}

function EndSheet({ view, mySeat, nameOf }: { view: LudoView; mySeat: number; nameOf: (s: number) => string; players: number }) {
  const t = useT();
  const winners = view.winners ?? [];
  const won = winners.includes(mySeat);
  const title = won
    ? winners.length > 1
      ? t("ludo.end.teamWin")
      : t("ludo.end.youWin")
    : winners.length > 1
      ? t("ludo.end.theyWinTeam", { a: nameOf(winners[0] as number), b: nameOf(winners[1] as number) })
      : t("ludo.end.theyWin", { name: nameOf(winners[0] as number) });
  return (
    <Sheet label={title}>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="animate-pop flex size-16 items-center justify-center rounded-full border-2 border-gold bg-black/40 text-gold-light shadow-[0_0_24px_rgb(216_167_72/0.5)]">
          <CrownIcon className="size-9" />
        </span>
        <h2 className="text-gilded text-2xl font-bold">{title}</h2>
        {!won && <p className="text-sm text-cafe-muted">{t("ludo.end.lost")}</p>}
        <div className="mt-2 flex w-full gap-2">
          <Link href="/" className="cafe-panel flex min-h-touch flex-1 items-center justify-center rounded-control px-3 text-sm font-semibold text-gold-light">
            {t("ludo.end.home")}
          </Link>
          <Link href="/play?game=ludo" className="gold-button flex min-h-touch flex-1 items-center justify-center rounded-control px-3 font-bold">
            {t("ludo.end.newTable")}
          </Link>
        </div>
      </div>
    </Sheet>
  );
}
