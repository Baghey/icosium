"use client";

import { LUDO_CAPTURE_MS, LUDO_DIE_MS, LUDO_HOP_MS, type LudoEvent } from "@icosium/shared";
import { useEffect, useRef, useState } from "react";
import { hopSteps } from "./ludo-geometry";
import { playCapture, playDiceRoll, playHop } from "./sound";

type Source = { pawns: number[][]; events: LudoEvent[]; eventSeq: number; die: number | null; turn: number };

export type Playback = {
  /** Positions affichées (elles avancent case par case pendant l'animation). */
  pawns: number[][];
  /** Nombre de sauts par pion « chaise:pion » (relance l'animation du saut). */
  hops: Record<string, number>;
  /** Pions mangés en train de rentrer à la maison. */
  returning: Set<string>;
  /** Dernier dé de chaque chaise, et une clé qui change à chaque lancer (animation). */
  dice: Record<number, { value: number; key: number }>;
  /** Une animation est en cours : on attend avant d'afficher la suite. */
  busy: boolean;
};

const clonePawns = (p: number[][]) => p.map((x) => [...x]);

/**
 * Rejoue à l'écran ce que le serveur vient de décider : le dé qui roule, puis le pion qui saute
 * de case en case, puis le pion mangé qui rentre chez lui. `onEvent` est appelé au bon moment
 * (bulle « Trois 6 ! », « Rejoue ! »…). Si on a raté des étapes (réseau), on se met juste à jour.
 */
export function useLudoPlayback(source: Source, onEvent?: (e: LudoEvent) => void): Playback {
  const [pawns, setPawns] = useState(() => clonePawns(source.pawns));
  const [hops, setHops] = useState<Record<string, number>>({});
  const [returning, setReturning] = useState<Set<string>>(new Set());
  const [dice, setDice] = useState<Record<number, { value: number; key: number }>>(() =>
    source.die ? { [source.turn]: { value: source.die, key: 0 } } : {},
  );
  const [busy, setBusy] = useState(false);
  const lastSeq = useRef(source.eventSeq);
  const prevPawns = useRef(clonePawns(source.pawns));
  const timers = useRef<number[]>([]);
  const rollKey = useRef(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  useEffect(() => {
    if (source.eventSeq === lastSeq.current) return;
    const jump = source.eventSeq - lastSeq.current;
    lastSeq.current = source.eventSeq;
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    const finalPawns = clonePawns(source.pawns);
    const start = clonePawns(prevPawns.current);
    prevPawns.current = finalPawns;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (jump !== 1 || reduce) {
      // Rien à animer (on a raté des étapes, ou l'appareil demande moins de mouvement).
      setPawns(finalPawns);
      setReturning(new Set());
      setBusy(false);
      for (const e of source.events) {
        if (e.type === "roll") setDice((d) => ({ ...d, [e.seat]: { value: e.value, key: reduce ? ++rollKey.current : d[e.seat]?.key ?? 0 } }));
        if (jump === 1) onEventRef.current?.(e);
      }
      if (reduce && source.events.some((e) => e.type === "roll")) playDiceRoll();
      return;
    }

    let t = 0;
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    const display = clonePawns(start);
    setPawns(clonePawns(display));
    setBusy(true);
    for (const e of source.events) {
      if (e.type === "roll") {
        at(t, () => {
          setDice((d) => ({ ...d, [e.seat]: { value: e.value, key: ++rollKey.current } }));
          playDiceRoll();
        });
        t += LUDO_DIE_MS;
      } else if (e.type === "move") {
        const key = `${e.owner}:${e.pawn}`;
        for (const step of hopSteps(e.from, e.to)) {
          at(t, () => {
            (display[e.owner] as number[])[e.pawn] = step;
            setPawns(clonePawns(display));
            setHops((h) => ({ ...h, [key]: (h[key] ?? 0) + 1 }));
            playHop();
          });
          t += LUDO_HOP_MS;
        }
        if (e.captured.length) {
          const keys = e.captured.map((c) => `${c.seat}:${c.pawn}`);
          at(t, () => {
            for (const c of e.captured) (display[c.seat] as number[])[c.pawn] = -1;
            setReturning(new Set(keys));
            setPawns(clonePawns(display));
            playCapture();
          });
          t += LUDO_CAPTURE_MS;
          at(t, () => setReturning(new Set()));
        }
        at(t, () => onEventRef.current?.(e));
      } else {
        at(t, () => onEventRef.current?.(e));
      }
    }
    at(t, () => {
      setPawns(finalPawns);
      setBusy(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.eventSeq]);

  return { pawns, hops, returning, dice, busy };
}
