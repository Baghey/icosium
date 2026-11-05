"use client";

import { type End, type TileId, playableEnds, teamOf } from "@icosium/shared";
import type { MessageKey } from "@icosium/i18n";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MicButton } from "@/components/mic-button";
import { useI18n } from "@/lib/i18n";
import { playClack, playYourTurn, preloadSounds } from "@/lib/sound";
import { type DominoView, type SeatInfo, seatKey } from "@/lib/domino-client";
import { DominoChain } from "./chain";
import { DominoHand } from "./hand";
import { Sheet } from "@/components/sheet";
import { Avatar, PlayerBadge, type PlayerInfo, tableAvatars } from "./player-badge";
import { SoundToggle } from "./sound-toggle";
import { DominoBack, DominoTile } from "./tile";
import { Emblem, HourglassIcon, RotateIcon, TrophyIcon, UsersIcon } from "@/components/cafe-icons";
import { useGameOrientation } from "@/lib/orientation";
import { useVoice } from "@/lib/voice-context";

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
  declare: (choice: "redeclare" | "keep") => Promise<void>;
};

const Table3D = dynamic(() => import("./table3d"), { ssr: false, loading: () => null });

/** La 3D a besoin de WebGL ; sinon on garde la table en image. */
function useWebGL(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setOk(Boolean(c.getContext("webgl2") ?? c.getContext("webgl")));
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

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
export function DominoGame({ code, view, seats, mySeat, hand, clockOffset, play, tick, nextRound, declare }: Props) {
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
  const [notice, setNotice] = useState<string | null>(null);
  const bots = view.bots ?? [];
  const botTurn = view.phase === "playing" && bots.includes(view.turn);

  const nameOf = (seat: number) => seats.find((s) => s.seat === seat)?.username ?? null;
  // Début de manche après 50 points : le gagnant ou son partenaire peut ouvrir (« ytchawro »).
  const openers = view.chain.length === 0 && view.phase === "playing" ? (view.openers ?? []) : [];
  const consulting = openers.length > 1;
  const isTurnOf = (seat: number) => view.phase === "playing" && (view.turn === seat || openers.includes(seat));
  const myTurn = isTurnOf(mySeat);

  // Coups possibles pour moi (le serveur revérifie tout).
  const moves = useMemo(
    () => (myTurn ? hand.flatMap((tile) => playableEnds(tile, view.chain, view.mustOpenWith).map((end) => ({ tile, end }))) : []),
    [myTurn, view.chain, view.mustOpenWith, hand],
  );
  const playable = useMemo(() => new Set(moves.map((m) => m.tile)), [moves]);
  const targets = selected ? playableEnds(selected, view.chain, view.mustOpenWith) : [];

  // Les vrais sons se chargent au premier toucher (le navigateur exige un geste pour le son).
  useEffect(() => {
    const go = () => preloadSounds();
    window.addEventListener("pointerdown", go, { once: true });
    return () => window.removeEventListener("pointerdown", go);
  }, []);

  // Sons, animations et bulles à chaque nouvel événement de la table.
  const lastSeq = useRef(view.eventSeq);
  useEffect(() => {
    if (view.eventSeq === lastSeq.current) return;
    lastSeq.current = view.eventSeq;
    // Le jeu a avancé : un ancien message (« Attends ton tour »…) n'a plus de sens.
    setError(null);
    const next: Record<number, string> = {};
    for (const e of view.events) {
      if (e.type === "play") {
        playClack(e.closing);
        setFreshTile(e.tile);
      } else if (e.type === "pass") next[e.seat] = t("domino.pass");
      else if (e.type === "draw") next[e.seat] = t("domino.drew", { n: e.count });
      else if (e.type === "redeal") {
        const who = e.seat === mySeat ? t("domino.you") : (nameOf(e.seat) ?? "…");
        setNotice(e.reason === "sixDoubles" ? t("domino.redealSixDoubles") : t("domino.redealFamily", { name: who }));
      } else if (e.type === "keep") {
        setNotice(t("domino.kept", { name: e.seat === mySeat ? t("domino.you") : (nameOf(e.seat) ?? "…") }));
      }
    }
    if (Object.keys(next).length) {
      setBubbles(next);
      window.setTimeout(() => setBubbles({}), 2600);
    }
    if (view.phase === "playing" && view.turn === mySeat) playYourTurn();
    setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.eventSeq, view.events, view.phase, view.turn, mySeat, t]);

  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(() => setError(null), 2600);
    return () => window.clearTimeout(id);
  }, [error]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(id);
  }, [notice]);

  // Chrono écoulé : on prévient le serveur, qui vérifie l'heure et joue à la place du joueur.
  const remainingMs = view.deadline === null ? null : view.deadline - serverNow;
  const tickedFor = useRef<string>("");
  useEffect(() => {
    // Pour un bot, on prévient vite (il « réfléchit » une seconde) ; pour un humain, avec une marge.
    const grace = botTurn || (view.phase === "declare" && view.declare && bots.includes(view.declare.seat)) ? -250 : -800;
    if (remainingMs === null || remainingMs > grace || view.phase === "gameOver") return;
    const key = `${view.eventSeq}-${Math.floor(-remainingMs / 4000)}`;
    if (tickedFor.current === key) return;
    tickedFor.current = key;
    void tick();
  }, [remainingMs, view.eventSeq, view.phase, view.declare, botTurn, bots, tick]);

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
          { seat: (mySeat + 3) % 4, pos: "left" as const },
          { seat: (mySeat + 2) % 4, pos: "top" as const },
          { seat: (mySeat + 1) % 4, pos: "right" as const },
        ]
      : [{ seat: (mySeat + 1) % 2, pos: "top" as const }];
  const turnSeconds = view.options.turnSeconds;
  const fraction = remainingMs === null || turnSeconds === 0 ? null : remainingMs / (turnSeconds * 1000);

  const myTeam = teamOf(mySeat);
  const usScore = view.scores[myTeam];
  const themScore = view.scores[myTeam === 0 ? 1 : 0];

  const { peers } = useVoice();
  const webgl = useWebGL();
  const orientation = useGameOrientation();
  const landscape = orientation.landscape;
  const reducedMotion = useReducedMotion();
  const avatars = useMemo(() => tableAvatars(seats.map(seatKey)), [seats]);
  const info = (seat: number): PlayerInfo => {
    const s = seats.find((x) => x.seat === seat);
    const peer = s?.userId ? peers.find((x) => x.identity === s.userId) : undefined;
    const bot = bots.includes(seat);
    return {
      name: seat === mySeat ? t("domino.you") : (s?.username ?? null),
      userId: s?.userId ?? null,
      avatar: s ? (avatars[seatKey(s)] ?? null) : null,
      score: view.scores[players === 2 ? (seat as 0 | 1) : teamOf(seat)],
      count: view.handCounts[seat] ?? 0,
      active: isTurnOf(seat),
      timeLeft: view.turn === seat && !bot ? fraction : null,
      bubble: bubbles[seat] ?? null,
      inVoice: Boolean(peer),
      micOn: Boolean(peer?.micOn),
      speaking: Boolean(peer?.isSpeaking && peer.micOn),
      partner: players === 4 && seat === (mySeat + 2) % 4,
      me: seat === mySeat,
      bot,
    };
  };

  const firstLink = view.chain[0];
  const lastLink = view.chain[view.chain.length - 1];
  const endChoice =
    selected && targets.length === 2 && firstLink && lastLink
      ? ([
          { end: "left" as const, value: firstLink.left },
          { end: "right" as const, value: lastLink.right },
        ] as const)
      : null;
  const hint = error ? t(error) : myTurn ? (view.mustOpenWith ? t("domino.mustOpen", { tile: view.mustOpenWith }) : selected ? t("domino.pickEnd") : null) : null;
  const secs = remainingMs === null ? null : Math.max(0, Math.ceil(remainingMs / 1000));
  const clock = secs === null ? null : `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  const turnLabel =
    view.phase !== "playing"
      ? t("domino.round", { n: view.round })
      : consulting
        ? myTurn
          ? t("domino.consultUs")
          : t("domino.consultThem")
        : myTurn
          ? t("domino.yourTurnShort")
          : botTurn
            ? t("domino.thinking", { name: nameOf(view.turn) ?? "…" })
            : t("domino.turnOf", { name: nameOf(view.turn) ?? "…" });

  // ---------- les morceaux de l'écran (réutilisés en portrait et en paysage) ----------

  const emblem = (
    <Link href="/play" aria-label={t("domino.leave")} className="flex size-touch shrink-0 items-center justify-center">
      <Emblem className="size-9 drop-shadow-[0_2px_6px_rgba(216,167,72,0.35)]" />
    </Link>
  );

  const scoreButton = (
    <button
      type="button"
      onClick={() => setShowScores(true)}
      className={`cafe-panel flex min-h-touch items-center gap-2.5 rounded-full px-3.5 text-sm font-semibold ${landscape ? "" : "mx-auto"}`}
      aria-label={t("domino.scores")}
    >
      {!landscape && (
        <>
          <UsersIcon className="size-4 text-cafe-muted" />
          <span className="text-cafe-muted">{seats.length}/{players}</span>
          <span className="h-4 w-px bg-gold/40" aria-hidden="true" />
        </>
      )}
      <TrophyIcon className="size-4 text-gold" />
      <span className="text-gold-light">{usScore}</span>
      <span className="text-cafe-muted">·</span>
      <span>{themScore}</span>
      <span className="text-xs font-normal text-cafe-muted">/ {view.options.targetScore}</span>
    </button>
  );

  const turnChip = (
    <div className={`cafe-panel flex items-center gap-2 rounded-2xl px-4 py-1 ${myTurn ? "border-gold" : ""}`} aria-live="polite">
      <HourglassIcon className={`size-4 ${myTurn ? "text-gold-light" : "text-cafe-muted"}`} />
      <span className="max-w-40 truncate text-sm font-medium">{turnLabel}</span>
      {clock && view.phase === "playing" && !botTurn && (
        <span className={`text-gilded text-lg font-bold tabular-nums ${secs !== null && secs <= 5 ? "animate-pulse" : ""}`}>{clock}</span>
      )}
    </div>
  );

  const rotateButton = orientation.phone && (
    <button
      type="button"
      onClick={orientation.toggle}
      aria-label={t("domino.rotate")}
      className="cafe-panel flex size-12 shrink-0 items-center justify-center rounded-full text-cafe-muted transition-colors duration-200 active:text-gold-light"
    >
      <RotateIcon className="size-5" />
    </button>
  );

  const badge = (seat: number, size: number) => <PlayerBadge p={info(seat)} size={size} />;
  const seatAt = (pos: "left" | "top" | "right") => around.find((a) => a.pos === pos)?.seat;
  const topSeat = seatAt("top");
  const leftSeat = seatAt("left");
  const rightSeat = seatAt("right");

  const table = (
    <>
      {webgl ? (
        <div className="absolute inset-0">
          <Table3D
            chain={view.chain}
            chainStart={view.chainStart ?? 0}
            targets={targets}
            onPick={(end) => selected && void doPlay(selected, end)}
            freshTile={freshTile}
            shuffleKey={`${view.round}`}
            players={players}
            reducedMotion={reducedMotion}
            glowEnds={selected ? [] : moves.map((m) => m.end)}
            landscape={landscape}
          />
        </div>
      ) : (
        <div className="table-photo relative h-full">
          <img src="/assets/rosette.webp" alt="" aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 w-[72%] max-w-72 -translate-x-1/2 -translate-y-1/2 opacity-35" />
          <div className="absolute -inset-x-6 -top-3 -bottom-10 flex items-center justify-center">
            {view.chain.length === 0 && !selected ? (
              <p className="text-gilded text-center text-lg font-semibold">{t("domino.round", { n: view.round })}</p>
            ) : (
              <DominoChain chain={view.chain} targets={targets} onPick={(end) => selected && void doPlay(selected, end)} pickLabel={t("domino.playHere")} freshTile={freshTile} />
            )}
          </div>
          {players === 2 && (
            <span className="absolute -bottom-9 end-0 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-xs text-cafe-text">
              <DominoBack size={6} /> {t("domino.boneyard", { n: view.boneyardCount })}
            </span>
          )}
        </div>
      )}
      {notice && (
        <p
          key={notice}
          role="status"
          className="animate-bubble cafe-panel absolute inset-x-6 top-2 z-20 mx-auto max-w-sm rounded-2xl border-gold/60 px-4 py-2 text-center text-sm font-semibold text-gold-light"
        >
          {notice}
        </p>
      )}
      {orientation.showHint && !notice && (
        <p className="animate-bubble cafe-panel pointer-events-none absolute inset-x-6 bottom-2 z-20 mx-auto flex max-w-xs items-center justify-center gap-2 rounded-2xl px-3 py-1.5 text-xs font-semibold text-gold-light">
          <RotateIcon className="size-4 shrink-0" />
          {t("domino.rotateHint")}
        </p>
      )}
      {view.penaltyTeam !== null && view.penaltyTeam !== undefined && view.phase === "playing" && (
        <span className="absolute end-3 bottom-2 z-10 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-[#e9a68f] ring-1 ring-[#e9826a]/50">
          {view.penaltyTeam === (players === 2 ? mySeat : teamOf(mySeat)) ? t("domino.us") : t("domino.them")} · {t("domino.penaltyChip")}
        </span>
      )}
    </>
  );

  const prompt = endChoice ? (
    // Deux bouts possibles : on choisit par le chiffre, plus simple que de viser la table.
    <div className="flex gap-2" role="group" aria-label={t("domino.pickEnd")}>
      {endChoice.map(({ end, value }) => (
        <button
          key={end}
          type="button"
          disabled={pending}
          onClick={() => selected && void doPlay(selected, end)}
          aria-label={`${t("domino.playHere")} · ${t("domino.playOn", { n: value })}`}
          className="gold-button animate-pop flex min-h-touch items-center rounded-full px-4 text-sm font-bold shadow-[0_4px_14px_rgba(0,0,0,0.45)] transition-transform duration-150 active:scale-95"
        >
          {t("domino.playOn", { n: value })}
        </button>
      ))}
    </div>
  ) : hint ? (
    <p
      role={error ? "alert" : undefined}
      className={`max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-semibold ${error ? "animate-bubble bg-danger text-white" : "bg-gold text-cafe-0"}`}
    >
      {hint}
    </p>
  ) : null;

  const handPanel = (
    <div className={`cafe-panel rounded-[1.5rem] px-1 transition-[border-color,box-shadow] duration-200 ${landscape ? "pt-2" : "pt-5"} ${myTurn ? "border-gold shadow-[0_0_24px_rgba(216,167,72,0.35)]" : ""}`}>
      <DominoHand tiles={hand} playable={playable} selected={selected} myTurn={myTurn} pending={pending} onTap={onTapTile} compact={landscape} />
    </div>
  );

  const me = (
    <div className="flex items-center gap-2">
      <Avatar p={info(mySeat)} size={40} />
      <div className="cafe-panel rounded-xl px-2.5 py-0.5 leading-tight">
        <p className="text-gilded text-xs font-bold">{t("domino.you")}</p>
        <p className="text-[11px] text-cafe-muted">{t("domino.pts", { n: usScore })}</p>
      </div>
    </div>
  );

  return (
    <div className="cafe-bg fixed inset-x-0 bottom-0 overflow-hidden text-cafe-text" style={{ top: "var(--voicebar, 0px)" }}>
      {landscape ? (
        // ---------- Paysage : la table au centre, les joueurs et les boutons sur les côtés ----------
        <div className="flex h-full gap-1 ps-[max(0.25rem,env(safe-area-inset-left))] pe-[max(0.25rem,env(safe-area-inset-right))]">
          <aside className="flex w-28 shrink-0 flex-col items-center justify-between py-2">
            {emblem}
            {leftSeat !== undefined ? badge(leftSeat, 44) : <span />}
            {me}
          </aside>

          <main className="flex min-w-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1">
              {table}
              <div className="pointer-events-none absolute inset-x-0 top-1 z-10 flex items-start justify-between gap-2 px-1">
                <div className="pointer-events-auto">{turnChip}</div>
                {topSeat !== undefined && <div className="pointer-events-auto">{badge(topSeat, 40)}</div>}
                <div className="pointer-events-auto">{scoreButton}</div>
              </div>
              {prompt && <div className="absolute inset-x-0 bottom-1 z-10 flex justify-center px-2">{prompt}</div>}
            </div>
            <section className="px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">{handPanel}</section>
          </main>

          <aside className="flex w-28 shrink-0 flex-col items-center justify-between py-2">
            <div className="flex gap-1">
              <SoundToggle tone="cafe" />
              {rotateButton}
            </div>
            {rightSeat !== undefined ? badge(rightSeat, 44) : <span />}
            <MicButton tone="cafe" />
          </aside>
        </div>
      ) : (
        // ---------- Portrait ----------
        <div className="mx-auto flex h-full max-w-xl flex-col">
          {/* En-tête : emblème, joueurs et score, son */}
          <header className="flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
            {emblem}
            {scoreButton}
            <SoundToggle tone="cafe" />
          </header>

          {/* Le chrono doré */}
          <div className="flex justify-center pt-2">{turnChip}</div>

          {/* Les autres joueurs, en rangée au-dessus de la table : rien ne cache le jeu */}
          <div className={`relative z-10 grid items-start px-2 pt-2 ${players === 4 ? "grid-cols-3" : "grid-cols-1"}`}>
            {around.map(({ seat, pos }) => (
              <div key={pos} className={`flex ${pos === "left" ? "justify-start pt-3" : pos === "right" ? "justify-end pt-3" : "justify-center"}`}>
                {badge(seat, pos === "top" ? 50 : 46)}
              </div>
            ))}
          </div>

          {/* La table */}
          <div className="relative min-h-0 flex-1 px-2 pb-1">{table}</div>

          {/* Ma main, dans un plateau sombre bordé d'or */}
          <section className="relative px-3 pt-5">
            <div className="absolute start-5 top-0 z-10">{me}</div>
            {prompt && <div className={`absolute end-4 z-10 flex max-w-[55%] justify-end ${endChoice ? "-top-2" : "top-1"}`}>{prompt}</div>}
            {handPanel}
          </section>

          {/* La barre du bas : scores, micro, son, rotation */}
          <nav className="flex items-center justify-center gap-5 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={() => setShowScores(true)} aria-label={t("domino.scores")} className="cafe-panel flex size-12 items-center justify-center rounded-full text-cafe-muted">
              <TrophyIcon className="size-5" />
            </button>
            <MicButton tone="cafe" />
            <SoundToggle tone="cafe" boxed />
            {rotateButton}
          </nav>
        </div>
      )}

      {(view.phase === "roundOver" || view.phase === "gameOver") && view.lastResult && (
        <RoundSheet view={view} seats={seats} mySeat={mySeat} serverNow={serverNow} onNext={nextRound} />
      )}
      {view.phase === "declare" && view.declare && (
        <DeclareSheet
          seat={view.declare.seat}
          family={view.declare.family}
          mine={view.declare.seat === mySeat}
          name={nameOf(view.declare.seat) ?? "…"}
          secondsLeft={remainingMs === null ? null : Math.max(0, Math.ceil(remainingMs / 1000))}
          onChoose={declare}
        />
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

/** Donne « 6 pierres d'une même famille » : le joueur choisit, les autres voient le message. */
function DeclareSheet({
  family,
  mine,
  name,
  secondsLeft,
  onChoose,
}: {
  seat: number;
  family: number;
  mine: boolean;
  name: string;
  secondsLeft: number | null;
  onChoose: (choice: "redeclare" | "keep") => Promise<void>;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const choose = async (choice: "redeclare" | "keep") => {
    setBusy(true);
    await onChoose(choice);
  };
  return (
    <Sheet>
      <div className="mb-4 flex flex-col items-center gap-2 text-center">
        <span className="animate-pop flex items-center gap-1" dir="ltr" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} style={{ transform: `rotate(${(i - 2.5) * 7}deg) translateY(${Math.abs(i - 2.5) * 3}px)` }}>
              <DominoTile a={family} b={i} orientation="vertical" size={16} />
            </span>
          ))}
        </span>
        <h2 className="text-gilded text-xl font-bold">{t("domino.declareTitle")}</h2>
        <p className="font-semibold">{mine ? t("domino.declareMine", { n: family }) : t("domino.declareOther", { name, n: family })}</p>
        <p className="text-sm text-cafe-muted">{t("domino.declareExplain")}</p>
      </div>
      {mine ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void choose("redeclare")}
            className="gold-button flex min-h-14 flex-col items-center justify-center rounded-card text-base font-bold transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
          >
            {t("domino.redeclare")}
            {secondsLeft !== null && <span className="text-xs font-semibold opacity-75">{secondsLeft} s</span>}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void choose("keep")}
            className="flex min-h-14 items-center justify-center rounded-card border border-gold/50 bg-black/30 text-base font-bold text-cafe-text transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
          >
            {t("domino.keep")}
          </button>
        </div>
      ) : (
        <p className="text-center text-sm font-semibold text-gold-light">{t("domino.declareWait", { n: secondsLeft ?? 0 })}</p>
      )}
    </Sheet>
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
          <span className={`animate-pop flex size-16 items-center justify-center rounded-full border border-gold/50 bg-black/30 ${won ? "text-gold-light shadow-[0_0_30px_rgba(216,167,72,0.5)]" : "text-cafe-muted"}`} aria-hidden="true">
            <TrophyIcon className="size-9" />
          </span>
          <h2 className="text-gilded text-2xl font-bold">{won ? t("domino.gameOverWin") : t("domino.gameOverLose")}</h2>
          {view.winnerTeam !== null && <p className="text-cafe-muted">{t("domino.gameOverTeam", { names: teamNames(seats, view.winnerTeam, players) })}</p>}
        </div>
      ) : (
        <div className="mb-3 text-center">
          <p className="text-sm text-cafe-muted">{t("domino.round", { n: r.round })}</p>
          <h2 className="text-xl font-semibold">{title}</h2>
          {r.winnerTeam !== null && (
            <p className={`animate-pop mt-1 text-lg font-semibold ${r.winnerTeam === myTeam ? "text-gold-light" : "text-[#e9826a]"}`}>{t("domino.points", { n: r.points })}</p>
          )}
          {r.winnerTeam === null && <p className="mt-1 text-sm text-cafe-muted">{t("domino.roundReplay")}</p>}
          {r.penalized && <p className="mt-1 text-sm font-semibold text-[#e9a68f]">{t("domino.penalized")}</p>}
        </div>
      )}

      <div className="mb-4 flex justify-center gap-6 text-center">
        <div>
          <p className="text-xs text-cafe-muted">{t("domino.us")}</p>
          <p className="text-3xl font-semibold text-gold-light">{view.scores[myTeam]}</p>
        </div>
        <div>
          <p className="text-xs text-cafe-muted">{t("domino.them")}</p>
          <p className="text-3xl font-semibold">{view.scores[myTeam === 0 ? 1 : 0]}</p>
        </div>
      </div>

      <p className="mb-2 text-xs font-semibold text-cafe-muted">{t("domino.remaining")}</p>
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
        <Link href="/" className="flex min-h-14 items-center justify-center rounded-card gold-button text-lg font-bold">
          {t("domino.backHome")}
        </Link>
      ) : (
        <button type="button" onClick={() => void onNext()} className="flex min-h-14 w-full items-center justify-center rounded-card gold-button text-lg font-bold transition-transform duration-150 active:scale-[0.98]">
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
      <p className="mb-4 text-sm text-cafe-muted">
        {t("domino.round", { n: view.round })} · {t("domino.scoreTo", { n: view.options.targetScore })}
      </p>
      <ul className="mb-5 flex flex-col gap-3">
        {teams.map((team, i) => {
          const score = view.scores[team];
          return (
            <li key={team} className="rounded-control border border-gold/25 bg-black/25 p-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {i === 0 ? t("domino.us") : t("domino.them")} · {teamNames(seats, team, players)}
                </span>
                <span className={`text-2xl font-semibold ${i === 0 ? "text-gold-light" : ""}`}>{score}</span>
              </div>
              <span className="block h-2 overflow-hidden rounded-full bg-white/10">
                <span className={`block h-full rounded-full ${i === 0 ? "bg-gold" : "bg-cafe-muted"}`} style={{ width: `${Math.min(100, (score / view.options.targetScore) * 100)}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={onClose} className="min-h-touch w-full rounded-control border border-gold/40 font-medium text-cafe-text">
        {t("domino.close")}
      </button>
    </Sheet>
  );
}
