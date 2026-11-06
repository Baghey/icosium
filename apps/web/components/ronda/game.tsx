"use client";

import {
  CARDS_PER_DEAL,
  type RondaAnnounce,
  type RondaAnnounceOutcome,
  type RondaCard,
  type RondaEvent,
  captureFor,
  rondaRankOf,
  rondaValue,
} from "@icosium/shared";
import type { MessageKey } from "@icosium/i18n";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CrownIcon } from "@/components/cafe-icons";
import { MicButton } from "@/components/mic-button";
import { SoundToggle } from "@/components/domino/sound-toggle";
import { tableAvatars } from "@/components/domino/player-badge";
import { PersonActions } from "@/components/social/person-actions";
import { Sheet } from "@/components/sheet";
import { type CallResult, type SeatInfo, seatKey } from "@/lib/domino-client";
import { useT } from "@/lib/i18n";
import type { RondaView } from "@/lib/ronda-client";
import { playYourTurn, preloadSounds } from "@/lib/sound";
import { useSocial } from "@/lib/social-context";
import { useRondaPlayback } from "@/lib/use-ronda-playback";
import { useVoice } from "@/lib/voice-context";
import { RondaRulesSheet, RulesButton } from "./rules-sheet";
import { type HandCardView, PILE_TARGET, RondaScreen, type RondaSeatPanel } from "./table";

type Props = {
  code: string;
  view: RondaView;
  hand: RondaCard[];
  seats: SeatInfo[];
  mySeat: number;
  clockOffset: number;
  play: (card: RondaCard, announce?: RondaAnnounce) => Promise<CallResult>;
  announce: (kind: RondaAnnounce) => Promise<CallResult>;
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
  not_your_turn: "ronda.error.not_your_turn",
  not_in_hand: "ronda.error.not_in_hand",
  too_late: "ronda.error.too_late",
  already_announced: "ronda.error.already_announced",
  conflict: "ronda.error.conflict",
};

/** Les chaises autour de moi, dans l'ordre de l'écran (gauche → droite). On joue chacun son tour : celui de droite joue après moi. */
export function seatsAround(players: number, me: number): number[] {
  return players === 4 ? [(me + 3) % 4, (me + 2) % 4, (me + 1) % 4] : [(me + 1) % 2];
}

/** Position d'une chaise à l'écran, par rapport au centre de la table (pour faire venir les cartes de sa main). */
export function spotFor(players: number, me: number, seat: number): { x: number; y: number } {
  if (seat === me) return { x: 0, y: 230 };
  const around = seatsAround(players, me);
  const i = around.indexOf(seat);
  if (players === 2) return { x: 0, y: -200 };
  return [
    { x: -120, y: -190 },
    { x: 0, y: -210 },
    { x: 120, y: -190 },
  ][i] ?? { x: 0, y: -200 };
}

export function cardName(t: ReturnType<typeof useT>, card: RondaCard): string {
  return t(`ronda.rank.${rondaRankOf(card)}` as MessageKey);
}

export function shoutKey(e: Extract<RondaEvent, { type: "play" }>): MessageKey | null {
  if (e.caida === 10) return "ronda.shout.caida10";
  if (e.caida === 5) return "ronda.shout.caida5";
  if (e.caida === 1) return "ronda.shout.caida1";
  if (e.missa) return "ronda.shout.missa";
  return null;
}

export function RondaGame({ code, view, hand, seats, mySeat, clockOffset, play, announce, tick }: Props) {
  const t = useT();
  const now = useNow(250);
  const serverNow = now + clockOffset;
  const players = view.options.players;
  const myTeam = players === 4 ? mySeat % 2 : mySeat;
  const teamOf = useCallback((seat: number) => (players === 4 ? seat % 2 : seat), [players]);
  const [pending, setPending] = useState<RondaCard | null>(null);
  const [selected, setSelected] = useState<RondaCard | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [bubbles, setBubbles] = useState<Record<number, string>>({});
  const [shout, setShout] = useState<{ text: string; key: number; big?: boolean } | null>(null);
  const [overlay, setOverlay] = useState<null | { kind: "announces"; outcomes: RondaAnnounceOutcome[]; points: [number, number] } | { kind: "round"; counts: [number, number]; points: [number, number] }>(null);
  const [showRules, setShowRules] = useState(false);
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null);
  const { peers } = useVoice();
  const { friends } = useSocial();

  const nameOf = useCallback((seat: number) => (seat === mySeat ? t("ronda.you") : (seats.find((s) => s.seat === seat)?.username ?? "…")), [mySeat, seats, t]);
  const teamName = (team: number) => (team === myTeam ? t("ronda.us") : t("ronda.them"));

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
  const overlayTimer = useRef<number | null>(null);
  const showOverlay = (o: NonNullable<typeof overlay>, ms: number) => {
    setOverlay(o);
    if (overlayTimer.current) window.clearTimeout(overlayTimer.current);
    overlayTimer.current = window.setTimeout(() => setOverlay(null), ms);
  };

  const playback = useRondaPlayback(
    view,
    (seat) => spotFor(players, mySeat, seat),
    (team) => (team === myTeam ? PILE_TARGET.us : PILE_TARGET.them),
    teamOf,
    {
      onShout: (e) => {
        const key = shoutKey(e);
        if (!key) return;
        const text = e.caida && e.missa ? `${t(key)} + ${t("ronda.shout.missa")}` : t(key);
        setShout({ text, key: Date.now(), big: e.caida >= 5 });
      },
      onEvent: (e) => {
        if (e.type === "announce") say(e.seat, t(e.kind === "tringa" ? "ronda.shout.tringa" : "ronda.shout.ronda"));
        else if (e.type === "announces") showOverlay({ kind: "announces", outcomes: e.outcomes, points: e.points }, 3600);
        else if (e.type === "roundEnd") showOverlay({ kind: "round", counts: e.counts, points: e.points }, 2600);
      },
    },
  );
  const busy = playback.busy;

  useEffect(() => {
    if (!shout) return;
    const id = window.setTimeout(() => setShout(null), 1350);
    return () => window.clearTimeout(id);
  }, [shout]);

  // La carte jouée quitte la main tout de suite (le serveur confirme ensuite).
  useEffect(() => {
    if (pending && !hand.includes(pending)) setPending(null);
  }, [hand, pending]);
  const myHand = hand.filter((c) => c !== pending);
  // Nouvelle donne : les cartes arrivent en glissant.
  const dealtKey = useRef("");
  const handKey = [...hand].sort().join(",");
  const freshDeal = hand.length === CARDS_PER_DEAL && dealtKey.current !== handKey;
  useEffect(() => {
    if (hand.length === CARDS_PER_DEAL) dealtKey.current = handKey;
  }, [handKey, hand.length]);

  const over = view.phase === "over";
  const myTurn = !over && view.turn === mySeat;
  const canPlay = myTurn && !busy && !pending;
  const canAnnounce = !over && !view.played[mySeat] && !view.announced[mySeat] && myHand.length === CARDS_PER_DEAL;

  // « C'est à toi » : un petit carillon quand la main arrive (après les animations).
  const rang = useRef("");
  useEffect(() => {
    const key = `${view.eventSeq}`;
    if (canPlay && rang.current !== key) {
      rang.current = key;
      playYourTurn();
    }
  }, [canPlay, view.eventSeq]);

  // Chrono écoulé (ou tour d'un bot) : on prévient le serveur, qui vérifie l'heure et joue.
  const remainingMs = view.deadline === null ? null : view.deadline - serverNow;
  const botTurn = view.bots.includes(view.turn);
  const tickedFor = useRef("");
  useEffect(() => {
    const grace = botTurn ? -150 : -800;
    if (remainingMs === null || remainingMs > grace || over) return;
    const key = `${view.eventSeq}-${Math.floor(-remainingMs / 4000)}`;
    if (tickedFor.current === key) return;
    tickedFor.current = key;
    void tick();
  }, [remainingMs, view.eventSeq, over, botTurn, tick]);

  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(() => setError(null), 2600);
    return () => window.clearTimeout(id);
  }, [error]);
  useEffect(() => {
    if (!myTurn) setSelected(null);
  }, [myTurn]);

  async function tapCard(card: RondaCard) {
    if (!myTurn) {
      setError("ronda.error.not_your_turn");
      return;
    }
    if (!canPlay) return;
    // Premier toucher : la carte se soulève et on voit ce qu'elle prend. Deuxième : on la pose.
    if (selected !== card) {
      setSelected(card);
      return;
    }
    setSelected(null);
    setPending(card);
    setError(null);
    const res = await play(card);
    if (!res.ok) {
      setPending(null);
      setError(ERRORS[res.error] ?? "ronda.error.unknown");
    }
  }

  async function doAnnounce(kind: RondaAnnounce) {
    setError(null);
    const res = await announce(kind);
    if (!res.ok) setError(ERRORS[res.error] ?? "ronda.error.unknown");
  }

  const avatars = useMemo(() => tableAvatars(seats.map((s) => ({ key: seatKey(s), botName: s.userId ? null : s.username }))), [seats]);
  const turnSeconds = view.options.turnSeconds;
  const fraction = remainingMs === null || turnSeconds === 0 || botTurn ? null : Math.max(0, remainingMs / (turnSeconds * 1000));

  const panels: (RondaSeatPanel | null)[] = seatsAround(players, mySeat).map((seat) => {
    const s = seats.find((x) => x.seat === seat);
    const peer = s?.userId ? peers.find((x) => x.identity === s.userId) : undefined;
    const active = !over && view.turn === seat;
    return {
      name: nameOf(seat),
      avatar: s ? (avatars[seatKey(s)] ?? null) : null,
      active,
      timeLeft: active ? fraction : null,
      inVoice: Boolean(peer),
      micOn: Boolean(peer?.micOn),
      speaking: Boolean(peer?.isSpeaking && peer.micOn),
      cards: view.handCounts[seat] ?? 0,
      bot: view.bots.includes(seat),
      partner: players === 4 && seat % 2 === mySeat % 2,
      bubble: bubbles[seat] ?? null,
      onTap: s?.userId ? () => setPerson({ id: s.userId as string, name: s.username }) : undefined,
    };
  });

  // Ce que prendrait la carte choisie : ces cartes brillent sur la table.
  const preview = selected ? captureFor(view.table, rondaValue(selected)) : [];
  const tableCards = playback.table.map((c) => (preview.includes(c.card) && c.phase === "still" ? { ...c, glow: true } : c));

  const handViews: HandCardView[] = myHand.map((card) => ({
    card,
    selected: selected === card,
    glow: canPlay && !selected,
    dealt: freshDeal,
    label: t("ronda.playCard", { card: cardName(t, card) }),
  }));

  const turnName = nameOf(view.turn);
  const secs = remainingMs === null || botTurn ? null : Math.max(0, Math.ceil(remainingMs / 1000));
  let status: string;
  if (error) status = t(error);
  else if (over || busy) status = "";
  else if (selected) status = `${preview.length ? t("ronda.status.takes", { n: preview.length }) : t("ronda.status.lays")} · ${t("ronda.status.confirm")}`;
  else if (myTurn) status = t("ronda.status.yourTurn");
  else status = t("ronda.status.theirTurn", { name: turnName });

  const announced = view.announced[mySeat];
  const actions = canAnnounce ? (
    <div className="flex items-center gap-2">
      {(["ronda", "tringa"] as const).map((kind) => (
        <button
          key={kind}
          type="button"
          onClick={() => void doAnnounce(kind)}
          className="cafe-panel flex min-h-touch flex-col items-center justify-center rounded-full border-gold/70 px-4 leading-tight text-gold-light transition-transform duration-150 active:scale-95"
        >
          <span className="text-sm font-bold">{t(kind === "ronda" ? "ronda.announce.ronda" : "ronda.announce.tringa")}</span>
          <span className="text-[10px] text-cafe-muted">{t(kind === "ronda" ? "ronda.announce.ronda1" : "ronda.announce.tringa5")}</span>
        </button>
      ))}
      {error && <span className="max-w-28 text-[11px] leading-tight text-danger">{t(error)}</span>}
    </div>
  ) : announced && !view.played[mySeat] ? (
    <span className="rounded-full border border-gold/60 bg-gold/15 px-3 py-1 text-xs font-semibold text-gold-light">
      {t("ronda.announce.done", { kind: t(announced === "tringa" ? "ronda.announce.tringa" : "ronda.announce.ronda") })}
    </span>
  ) : undefined;

  const dealsPerRound = players === 4 ? 3 : 6;
  const round = `${t("ronda.round", { n: view.round })} · ${view.deal}/${dealsPerRound}`;

  return (
    <RondaScreen
      leave={{ href: "/play", label: t("ronda.leave") }}
      tools={
        <>
          <SoundToggle tone="cafe" />
          <RulesButton onClick={() => setShowRules(true)} />
        </>
      }
      chip={{ label: over ? t("ronda.gameOver") : myTurn ? t("ronda.yourTurnChip") : t("ronda.turnOf", { name: turnName }), seconds: secs, fraction, mine: myTurn }}
      seats={panels}
      score={{ us: playback.scores[myTeam] ?? 0, them: playback.scores[1 - myTeam] ?? 0, target: view.options.target, usLabel: t("ronda.us"), themLabel: t("ronda.them") }}
      round={round}
      deckCount={view.deckCount}
      piles={{ us: playback.piles[myTeam] ?? 0, them: playback.piles[1 - myTeam] ?? 0 }}
      tableCards={tableCards}
      shout={shout}
      overlay={overlay && <Overlay o={overlay} myTeam={myTeam} nameOf={nameOf} teamName={teamName} onClose={() => setOverlay(null)} />}
      status={status}
      actions={actions}
      hand={handViews}
      onHandTap={(c) => void tapCard(c)}
      myBubble={bubbles[mySeat] ?? null}
      bottomStart={<span className="text-[11px] font-semibold tracking-[0.2em] text-cafe-muted" dir="ltr">{code}</span>}
      bottomCenter={<MicButton tone="cafe" />}
    >
      {showRules && <RondaRulesSheet target={view.options.target} onClose={() => setShowRules(false)} learnHref="/ronda/learn" />}
      {over && !busy && view.winner !== null && <EndSheet view={view} mySeat={mySeat} myTeam={myTeam} nameOf={nameOf} />}
      {person && (
        <PersonActions id={person.id} name={person.name} isFriend={friends.some((f) => f.id === person.id && f.status === "accepted")} atTable onClose={() => setPerson(null)} />
      )}
    </RondaScreen>
  );
}

/** Le panneau posé sur le feutre : annonces vérifiées, ou fin de manche. Toucher le ferme. */
export function Overlay({
  o,
  myTeam,
  nameOf,
  teamName,
  onClose,
}: {
  o: { kind: "announces"; outcomes: RondaAnnounceOutcome[]; points: [number, number] } | { kind: "round"; counts: [number, number]; points: [number, number] };
  myTeam: number;
  nameOf: (seat: number) => string;
  teamName: (team: number) => string;
  onClose: () => void;
}) {
  const t = useT();
  const kindName = (k: RondaAnnounce | null) => t(k === "tringa" ? "ronda.announce.tringa" : "ronda.announce.ronda").replace(/\s*!$/, "");
  const valueName = (v: number | null) => (v ? t(`ronda.rank.${["A", "2", "3", "4", "5", "6", "7", "J", "Q", "K"][v - 1]}` as MessageKey) : "");
  const teams = [myTeam, 1 - myTeam];
  return (
    <button type="button" onClick={onClose} className="animate-pop absolute inset-x-6 top-1/2 z-20 -translate-y-1/2 rounded-card border border-gold/70 px-4 py-3 text-center shadow-[0_14px_30px_rgb(0_0_0/0.6)]" style={{ background: "linear-gradient(180deg, rgb(42 29 19 / 0.97), rgb(18 11 6 / 0.97))" }}>
      <p className="text-gilded text-sm font-bold tracking-[0.2em] uppercase">{t(o.kind === "announces" ? "ronda.result.title" : "ronda.roundEnd.title")}</p>
      {o.kind === "announces" ? (
        <ul className="mt-2 flex flex-col gap-1 text-[13px] text-cafe-text">
          {o.outcomes.map((x) => (
            <li key={x.seat}>
              {t(`ronda.result.${x.result}` as MessageKey, {
                name: nameOf(x.seat),
                kind: kindName(x.result === "forgot" ? x.held : x.announced),
                value: valueName(x.value),
              })}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {teams.map((team) => (
              <li key={team} className="flex items-center justify-between gap-3">
                <span>{t("ronda.roundEnd.cards", { team: teamName(team), n: o.counts[team as 0 | 1] })}</span>
                <b className={o.points[team as 0 | 1] ? "text-gilded" : "text-cafe-muted"}>{t("ronda.roundEnd.points", { n: o.points[team as 0 | 1] })}</b>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-cafe-muted">{t("ronda.roundEnd.rule")}</p>
        </>
      )}
      {o.kind === "announces" && (
        <p className="mt-2 flex justify-center gap-3 text-sm font-bold">
          {teams
            .filter((team) => o.points[team as 0 | 1] > 0)
            .map((team) => (
              <span key={team} className="text-gilded">
                {t("ronda.result.points", { team: teamName(team), n: o.points[team as 0 | 1] })}
              </span>
            ))}
        </p>
      )}
    </button>
  );
}

function EndSheet({ view, mySeat, myTeam, nameOf }: { view: RondaView; mySeat: number; myTeam: number; nameOf: (s: number) => string }) {
  const t = useT();
  const winner = view.winner as number;
  const won = winner === myTeam;
  const players = view.options.players;
  const title = won
    ? players === 4
      ? t("ronda.end.youWin")
      : t("ronda.end.youWinSolo")
    : players === 4
      ? t("ronda.end.theyWinTeam", { a: nameOf(winner), b: nameOf(winner + 2) })
      : t("ronda.end.theyWin", { name: nameOf(winner === mySeat ? mySeat : 1 - mySeat) });
  return (
    <Sheet label={title}>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="animate-pop flex size-16 items-center justify-center rounded-full border-2 border-gold bg-black/40 text-gold-light shadow-[0_0_24px_rgb(216_167_72/0.5)]">
          <CrownIcon className="size-9" />
        </span>
        <h2 className="text-gilded text-2xl font-bold">{title}</h2>
        <p className="text-lg font-semibold tabular-nums">{t("ronda.end.score", { us: view.scores[myTeam] ?? 0, them: view.scores[1 - myTeam] ?? 0 })}</p>
        {!won && <p className="text-sm text-cafe-muted">{t("ronda.end.lost")}</p>}
        <div className="mt-2 flex w-full gap-2">
          <Link href="/" className="cafe-panel flex min-h-touch flex-1 items-center justify-center rounded-control px-3 text-sm font-semibold text-gold-light">
            {t("ronda.end.home")}
          </Link>
          <Link href="/play?game=ronda" className="gold-button flex min-h-touch flex-1 items-center justify-center rounded-control px-3 font-bold">
            {t("ronda.end.newTable")}
          </Link>
        </div>
      </div>
    </Sheet>
  );
}
