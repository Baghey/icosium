"use client";

import {
  BASE_STEP,
  LUDO_CAPTURE_MS,
  LUDO_DIE_MS,
  LUDO_HOP_MS,
  type LudoColor,
  type LudoEvent,
  type LudoState,
  applyLudoMove,
  applyLudoRoll,
  createLudoGame,
  targetStep,
} from "@icosium/shared";
import type { MessageKey } from "@icosium/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SoundToggle } from "@/components/domino/sound-toggle";
import { CrownIcon } from "@/components/cafe-icons";
import { useT } from "@/lib/i18n";
import { BASE_ORIGIN, hopSteps, pawnPoint, quarterFor, rotatePoint, screenCorner } from "@/lib/ludo-geometry";
import { preloadSounds } from "@/lib/sound";
import { useLudoPlayback } from "@/lib/use-ludo-playback";
import { type BoardPawn, CELL } from "./board";
import type { LudoPlayer } from "./player-panel";
import { LudoRulesSheet, RulesButton } from "./rules-sheet";
import { LudoScreen } from "./table";

/**
 * « Apprendre à jouer » : une petite partie guidée, sur le vrai plateau, jouée seul sur le téléphone.
 * Rien n'est envoyé au serveur. Les règles sont les mêmes que celles du vrai jeu (packages/shared) ;
 * seuls les dés sont préparés à l'avance, pour montrer chaque règle une fois. Yasmine est un
 * personnage scénarisé, pas un bot de table.
 */

const ME = 1;
const YASMINE = 0;
const H = BASE_STEP;
const STORAGE_KEY = "icosium.ludo.learn";

type Spot = "die" | "base" | "pawn" | "none";
type Step = {
  id: "intro" | "roll1" | "needSix" | "roll6" | "exit" | "rollAgain" | "capture" | "captured" | "star" | "starInfo" | "threeSixes" | "later" | "rollTooMuch" | "exact" | "rollExact" | "finish";
  expect: "next" | "roll" | "move";
  die?: number;
  spot: Spot;
  /** Leçon (pour les points de progression en haut). */
  lesson: number;
  /** Ce que joue Yasmine après cette étape : un lancer, puis le pion qu'elle bouge. */
  opponent?: { die: number; pawn: number }[];
  /** Une donne préparée (« un peu plus tard… »). */
  enter?: (s: LudoState) => LudoState;
};

function scene1(): LudoState {
  // Partie à deux, déjà commencée : Yasmine (rouge) a deux pions dehors, tes pions jaunes sont à la maison.
  const s = createLudoGame({ players: 2, teams: false, pawnsToWin: 1, turnSeconds: 0, botAllowed: false }, () => 0.99, 0);
  s.pawns = [
    [30, 34, H, H],
    [H, H, H, H],
  ];
  s.events = [];
  return s;
}

function scene2(prev: LudoState): LudoState {
  return {
    ...prev,
    pawns: [
      [20, 40, H, H],
      [53, H, H, H],
    ],
    turn: ME,
    mover: ME,
    phase: "roll",
    die: null,
    sixes: 0,
    movable: [],
    events: [],
    eventSeq: prev.eventSeq + 1,
  };
}

const STEPS: Step[] = [
  { id: "intro", expect: "next", spot: "base", lesson: 0 },
  { id: "roll1", expect: "roll", die: 4, spot: "die", lesson: 1 },
  { id: "needSix", expect: "next", spot: "none", lesson: 1, opponent: [{ die: 6, pawn: 2 }, { die: 3, pawn: 2 }] },
  { id: "roll6", expect: "roll", die: 6, spot: "die", lesson: 1 },
  { id: "exit", expect: "move", spot: "pawn", lesson: 1 },
  { id: "rollAgain", expect: "roll", die: 4, spot: "die", lesson: 2 },
  { id: "capture", expect: "move", spot: "pawn", lesson: 2 },
  { id: "captured", expect: "roll", die: 4, spot: "die", lesson: 2 },
  { id: "star", expect: "move", spot: "pawn", lesson: 3 },
  { id: "starInfo", expect: "next", spot: "pawn", lesson: 3, opponent: [{ die: 5, pawn: 2 }] },
  { id: "threeSixes", expect: "next", spot: "none", lesson: 4 },
  { id: "later", expect: "next", spot: "pawn", lesson: 5, enter: scene2 },
  { id: "rollTooMuch", expect: "roll", die: 5, spot: "die", lesson: 5 },
  { id: "exact", expect: "next", spot: "pawn", lesson: 5, opponent: [{ die: 2, pawn: 0 }] },
  { id: "rollExact", expect: "roll", die: 3, spot: "die", lesson: 5 },
  { id: "finish", expect: "move", spot: "pawn", lesson: 5 },
];
const LESSONS = 6;

function must(r: ReturnType<typeof applyLudoRoll>): LudoState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** Ce que fait Yasmine : lancer, puis bouger le pion prévu. */
function opponentTurn(s: LudoState, a: { die: number; pawn: number }): LudoState[] {
  const rolled = must(applyLudoRoll(s, YASMINE, a.die, 0, false));
  if (rolled.phase !== "move" || rolled.turn !== YASMINE) return [rolled];
  const pawn = rolled.movable.includes(a.pawn) ? a.pawn : (rolled.movable[0] as number);
  return [rolled, must(applyLudoMove(rolled, YASMINE, pawn, 0))];
}

/** Rejoue toutes les étapes jusqu'à `upTo` sans animation (pour reprendre là où on s'est arrêté). */
function simulate(upTo: number): LudoState {
  let s = scene1();
  for (let i = 0; i < upTo; i++) {
    const step = STEPS[i] as Step;
    if (step.enter) s = step.enter(s);
    if (step.expect === "roll") s = must(applyLudoRoll(s, ME, step.die as number, 0, false));
    if (step.expect === "move") s = must(applyLudoMove(s, ME, s.movable[0] as number, 0));
    for (const a of step.opponent ?? []) s = opponentTurn(s, a).at(-1) as LudoState;
  }
  return { ...s, events: [], eventSeq: s.eventSeq + 1 };
}

/** Durée des animations d'un état (le dé, les sauts, le pion mangé). */
function animMs(events: LudoEvent[]): number {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 250;
  let t = 0;
  for (const e of events) {
    if (e.type === "roll") t += LUDO_DIE_MS;
    if (e.type === "move") t += hopSteps(e.from, e.to).length * LUDO_HOP_MS + (e.captured.length ? LUDO_CAPTURE_MS : 0);
  }
  return t + 250;
}

function readProgress(): number | "done" {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "done") return "done";
    const n = Number(v);
    return Number.isInteger(n) && n > 0 && n < STEPS.length ? n : 0;
  } catch {
    return 0;
  }
}
function saveProgress(v: number | "done") {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(v));
  } catch {
    // stockage indisponible : on recommencera du début
  }
}

type Rect = { x: number; y: number; r: number };

export function LudoTutorial() {
  const t = useT();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<LudoState>(scene1);
  const [mode, setMode] = useState<"await" | "anim" | "opponent" | "done">("await");
  const [hint, setHint] = useState<MessageKey | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [spot, setSpot] = useState<Rect | null>(null);
  const timers = useRef<number[]>([]);
  const boardRef = useRef<SVGSVGElement | null>(null);
  const dieRef = useRef<HTMLButtonElement | null>(null);
  const step = STEPS[index] as Step;
  const playback = useLudoPlayback(state);

  // Reprendre là où on s'était arrêté.
  useEffect(() => {
    const saved = readProgress();
    if (typeof saved === "number" && saved > 0) {
      setIndex(saved);
      setState(simulate(saved));
    }
    const go = () => preloadSounds();
    window.addEventListener("pointerdown", go, { once: true });
    return () => {
      window.removeEventListener("pointerdown", go);
      timers.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const goTo = useCallback((next: number, s: LudoState) => {
    if (next >= STEPS.length) {
      saveProgress("done");
      setMode("done");
      return;
    }
    saveProgress(next);
    const nextStep = STEPS[next] as Step;
    const entered = nextStep.enter ? nextStep.enter(s) : s;
    if (entered !== s) setState(entered);
    setIndex(next);
    setMode("await");
  }, []);

  /** Après l'action de l'élève : on laisse l'animation se jouer, puis Yasmine joue, puis étape suivante. */
  const finishStep = useCallback(
    (s: LudoState, wait: number) => {
      setMode("anim");
      later(wait, () => {
        const actions = STEPS[index]?.opponent ?? [];
        if (!actions.length) return goTo(index + 1, s);
        setMode("opponent");
        let cur = s;
        let at = 350;
        for (const a of actions) {
          for (const next of opponentTurn(cur, a)) {
            const snapshot = next;
            later(at, () => setState(snapshot));
            at += animMs(next.events) + 200;
            cur = next;
          }
        }
        const end = cur;
        later(at, () => goTo(index + 1, end));
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index, goTo],
  );

  function onNext() {
    if (mode !== "await" || step.expect !== "next") return;
    setHint(null);
    finishStep(state, 0);
  }

  function onRoll() {
    if (mode !== "await") return setHint(mode === "opponent" ? "ludo.learn.wrong.wait" : null);
    if (step.expect !== "roll") return setHint(step.expect === "move" ? "ludo.learn.wrong.pawnFirst" : null);
    setHint(null);
    const next = must(applyLudoRoll(state, ME, step.die as number, 0, false));
    setState(next);
    finishStep(next, animMs(next.events));
  }

  function onPawn(seat: number, pawn: number) {
    if (mode !== "await" || step.expect !== "move" || seat !== ME) return;
    setHint(null);
    const next = must(applyLudoMove(state, ME, pawn, 0));
    setState(next);
    finishStep(next, animMs(next.events));
  }

  function onMiss(near: { seat: number; pawn: number } | null) {
    if (mode === "opponent") return setHint("ludo.learn.wrong.wait");
    if (mode !== "await") return;
    if (step.expect === "roll") return setHint("ludo.learn.wrong.rollFirst");
    if (step.expect === "move") {
      const mine = near && near.seat === ME ? (state.pawns[ME]?.[near.pawn] ?? null) : null;
      setHint(mine === H ? "ludo.learn.wrong.needSix" : mine !== null ? "ludo.learn.wrong.cannotMove" : "ludo.learn.wrong.pawnFirst");
    }
  }

  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(null), 2800);
    return () => window.clearTimeout(id);
  }, [hint]);

  const myColor = state.colors[ME] as LudoColor;
  const quarter = quarterFor(myColor);

  // Le cercle doré : sur le dé, sur la maison, ou sur le pion à toucher.
  const measure = useCallback(() => {
    if (mode !== "await" || step.spot === "none") return setSpot(null);
    if (step.spot === "die") {
      const r = dieRef.current?.getBoundingClientRect();
      return setSpot(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 - 6, r: 46 } : null);
    }
    const svg = boardRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return setSpot(null);
    let pt: { x: number; y: number };
    let radius: number;
    if (step.spot === "base") {
      const [ox, oy] = BASE_ORIGIN[myColor];
      pt = rotatePoint({ x: ox + 3, y: oy + 3 }, quarter);
      radius = 3.2;
    } else {
      const pawn = state.phase === "move" && state.turn === ME ? (state.movable[0] ?? 0) : 0;
      pt = rotatePoint(pawnPoint(myColor, state.pawns[ME]?.[pawn] ?? H, pawn), quarter);
      radius = 1.25;
    }
    const p = new DOMPoint(pt.x * CELL, pt.y * CELL - 4).matrixTransform(ctm);
    const scale = ctm.a || 1;
    setSpot({ x: p.x, y: p.y, r: radius * CELL * scale });
  }, [mode, step, state, myColor, quarter]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const corners: (LudoPlayer | null)[] = [null, null, null, null];
  state.colors.forEach((color, seat) => {
    corners[screenCorner(color, quarter)] = {
      name: seat === ME ? t("ludo.you") : t("ludo.learn.coach"),
      color,
      avatar: seat === ME ? null : "/assets/avatars/3.webp",
      active: state.phase !== "over" && state.turn === seat,
      timeLeft: null,
      inVoice: false,
      micOn: false,
      speaking: false,
      finished: (playback.pawns[seat] ?? []).filter((p) => p === 56).length,
      pawnsToWin: 1,
      die: seat === ME ? null : (playback.dice[seat] ?? null),
      bot: false,
      partner: false,
      bubble: null,
    };
  });

  const canMove = mode === "await" && step.expect === "move" && state.phase === "move" && state.turn === ME;
  const pawns: BoardPawn[] = state.colors.flatMap((color, seat) =>
    (playback.pawns[seat] ?? []).map((stepValue, pawn) => {
      const key = `${seat}:${pawn}`;
      const movable = canMove && seat === ME && state.movable.includes(pawn);
      return {
        key,
        seat,
        pawn,
        color,
        step: stepValue,
        hops: playback.hops[key] ?? 0,
        returning: playback.returning.has(key),
        movable,
        target: movable && state.die ? targetStep(state.pawns[seat]?.[pawn] ?? H, state.die) : null,
      };
    }),
  );

  const myDie = playback.dice[ME];
  const cardTop = spot ? spot.y > window.innerHeight * 0.5 : false;
  const text = t(`ludo.learn.step.${step.id}` as MessageKey);
  const lesson = step.lesson;

  function skip() {
    saveProgress(index);
    router.push("/play?game=ludo");
  }
  function restart() {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    saveProgress(0);
    setIndex(0);
    setState({ ...scene1(), eventSeq: state.eventSeq + 1 });
    setMode("await");
  }

  return (
    <LudoScreen
      corners={corners}
      quarter={quarter}
      active={state.colors}
      pawns={pawns}
      onPawn={onPawn}
      onMiss={onMiss}
      pawnLabel={(p) => t("ludo.pawn", { n: p.pawn + 1 })}
      chip={{ label: state.turn === ME ? t("ludo.yourTurnChip") : t("ludo.turnOf", { name: t("ludo.learn.coach") }), seconds: null, fraction: null, mine: state.turn === ME }}
      status={mode === "opponent" ? t("ludo.learn.opponentPlays") : ""}
      die={{
        value: myDie?.value ?? null,
        rollKey: myDie?.key ?? 0,
        canRoll: mode === "await" && step.expect === "roll",
        onRoll,
        busy: false,
        onBlocked: onRoll,
      }}
      leave={{ href: "/play?game=ludo", label: t("ludo.leave") }}
      tools={
        <>
          <SoundToggle tone="cafe" />
          <RulesButton onClick={() => setShowRules(true)} />
          <button type="button" onClick={skip} className="flex min-h-touch items-center rounded-full border border-gold/50 px-3 text-sm font-semibold text-gold-light" style={{ background: "rgb(22 14 9 / 0.85)" }}>
            {t("ludo.learn.skip")}
          </button>
        </>
      }
      bottomStart={<span />}
      bottomCenter={<span className="size-mic" aria-hidden="true" />}
      boardRef={boardRef}
      dieRef={dieRef}
    >
      {/* Le reste de l'écran est un peu assombri ; le cercle doré pulse sur ce qu'il faut toucher. */}
      {spot && mode === "await" && (
        <span
          aria-hidden="true"
          className="ludo-motion animate-spot pointer-events-none fixed z-40 rounded-full"
          style={{
            left: spot.x - spot.r,
            top: spot.y - spot.r,
            width: spot.r * 2,
            height: spot.r * 2,
            boxShadow: "0 0 0 9999px rgb(8 5 3 / 0.62), 0 0 0 3px var(--gold-light)",
          }}
        />
      )}

      {mode !== "done" && (
        <div
          className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-3 ${cardTop ? "top-[calc(var(--voicebar,0px)+3.4rem)]" : "bottom-[max(6.5rem,calc(env(safe-area-inset-bottom)+6rem))]"}`}
        >
          <div
            key={index}
            role="status"
            className="animate-pop cafe-panel pointer-events-auto w-full max-w-sm rounded-[1.1rem] px-4 py-3"
            style={{ background: "linear-gradient(180deg, rgb(42 29 19 / 0.97), rgb(18 11 6 / 0.97))" }}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[0.2em] text-gold uppercase">{t("ludo.learn.title")}</span>
              <span className="flex gap-1" aria-hidden="true">
                {Array.from({ length: LESSONS }, (_, i) => (
                  <i key={i} className={`block h-1.5 rounded-full transition-all duration-200 ${i < lesson ? "w-1.5 bg-gold" : i === lesson ? "w-4 bg-gold-light" : "w-1.5 bg-gold/25"}`} />
                ))}
              </span>
            </div>
            <p className="text-[15px] leading-snug text-cafe-text">{hint ? <span className="text-gold-light">{t(hint)}</span> : text}</p>
            {step.expect === "next" && mode === "await" && (
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={onNext} className="gold-button min-h-touch rounded-full px-6 text-sm font-bold transition-transform duration-150 active:scale-[0.97]">
                  {t("ludo.learn.next")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {mode === "done" && (
        <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("ludo.learn.doneTitle")}
            className="animate-sheet cafe-panel w-full max-w-md rounded-t-[1.75rem] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center sm:rounded-[1.75rem]"
            style={{ background: "linear-gradient(180deg, #2a1d13, #120b06)" }}
          >
            <span className="animate-pop mx-auto flex size-16 items-center justify-center rounded-full border-2 border-gold bg-black/40 text-gold-light shadow-[0_0_24px_rgb(216_167_72/0.5)]">
              <CrownIcon className="size-9" />
            </span>
            <h2 className="text-gilded mt-3 text-2xl font-bold">{t("ludo.learn.doneTitle")}</h2>
            <p className="mt-2 text-sm text-cafe-muted">{t("ludo.learn.doneText")}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Link href="/play?game=ludo" className="gold-button flex min-h-14 items-center justify-center rounded-card px-6 text-lg font-bold">
                {t("ludo.learn.openTable")}
              </Link>
              <button type="button" onClick={restart} className="flex min-h-touch items-center justify-center rounded-control text-sm font-semibold text-gold-light">
                {t("ludo.learn.again")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRules && <LudoRulesSheet pawnsToWin={4} onClose={() => setShowRules(false)} />}
    </LudoScreen>
  );
}
