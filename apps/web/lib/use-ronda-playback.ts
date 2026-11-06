"use client";

import type { RondaCard, RondaEvent, RondaPublicView } from "@icosium/shared";
import { useEffect, useRef, useState } from "react";
import type { TableCardView } from "@/components/ronda/table";
import { playCardFlick, playCardShuffle, playCardSweep } from "./sound";

/** Où se trouve chaque chaise à l'écran, par rapport au centre de la table (px). */
export type SeatSpot = (seat: number) => { x: number; y: number };

type Played = {
  table: TableCardView[];
  /** Scores et tas affichés : ils changent quand l'animation y arrive, pas avant. */
  scores: [number, number];
  piles: [number, number];
  busy: boolean;
};

type Callbacks = {
  /** Un mot crié au centre (caïda, missa). */
  onShout?: (e: Extract<RondaEvent, { type: "play" }>) => void;
  onEvent?: (e: RondaEvent) => void;
};

const still = (cards: readonly RondaCard[]): TableCardView[] => cards.map((card) => ({ card, phase: "still" }));

/** Durées (ms) : courtes, comme le reste de l'app. */
const LAND_MS = 260;
const TAKE_MS = 260;
const PAUSE_MS = 140;

/**
 * Rejoue les derniers événements de la table pour les yeux : la carte arrive de la main de celui
 * qui joue, claque sur le feutre, puis les cartes prises glissent vers le tas de l'équipe.
 * Après une coupure (plusieurs coups manqués), on se cale directement sur la table du serveur.
 */
export function useRondaPlayback(
  view: Pick<RondaPublicView, "eventSeq" | "events" | "table" | "scores" | "pileCounts" | "options"> | null,
  spot: SeatSpot,
  pileOf: (team: number) => { x: number; y: number },
  teamOf: (seat: number) => number,
  cb: Callbacks = {},
): Played {
  const [played, setPlayed] = useState<Played>(() => ({
    table: still(view?.table ?? []),
    scores: view ? [...view.scores] : [0, 0],
    piles: view ? [...view.pileCounts] : [0, 0],
    busy: false,
  }));
  const seqRef = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const cbRef = useRef(cb);
  cbRef.current = cb;
  const fnRef = useRef({ spot, pileOf, teamOf });
  fnRef.current = { spot, pileOf, teamOf };

  useEffect(() => {
    if (!view) return;
    const prevSeq = seqRef.current;
    if (prevSeq === view.eventSeq) return;
    seqRef.current = view.eventSeq;
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];

    const final: Played = { table: still(view.table), scores: [...view.scores], piles: [...view.pileCounts], busy: false };
    // Premier affichage ou coups manqués : pas d'animation, on se cale sur le serveur.
    if (prevSeq === null || view.eventSeq !== prevSeq + 1) {
      setPlayed(final);
      return;
    }

    const { spot: spotOf, pileOf: pile, teamOf: team } = fnRef.current;
    let at = 0;
    const later = (ms: number, fn: () => void) => {
      if (ms <= 0) fn();
      else timers.current.push(window.setTimeout(fn, ms));
    };
    setPlayed((p) => ({ ...p, busy: true }));

    for (const e of view.events) {
      if (e.type === "play") {
        const from = spotOf(e.seat);
        later(at, () => {
          cbRef.current.onEvent?.(e);
          playCardFlick();
          setPlayed((p) => ({ ...p, table: [...p.table.filter((c) => c.card !== e.card), { card: e.card, phase: "in", from }] }));
        });
        at += LAND_MS;
        const taken = [...e.captured, ...(e.captured.length || e.stolen.length ? [e.card] : [])];
        if (taken.length) {
          const to = pile(team(e.seat));
          later(at + PAUSE_MS, () => {
            if (e.caida || e.missa) cbRef.current.onShout?.(e);
            playCardSweep(taken.length + e.stolen.length);
            setPlayed((p) => ({ ...p, table: p.table.map((c) => (taken.includes(c.card) ? { ...c, phase: "out", to } : c)) }));
          });
          at += PAUSE_MS + TAKE_MS;
          later(at, () => setPlayed((p) => ({ ...p, table: p.table.filter((c) => !taken.includes(c.card)) })));
        }
      } else if (e.type === "sweep") {
        const to = pile(e.team);
        later(at, () => {
          cbRef.current.onEvent?.(e);
          playCardSweep(e.cards.length);
          setPlayed((p) => ({ ...p, table: p.table.map((c) => (e.cards.includes(c.card) ? { ...c, phase: "out", to } : c)) }));
        });
        at += TAKE_MS + PAUSE_MS;
        later(at, () => setPlayed((p) => ({ ...p, table: p.table.filter((c) => !e.cards.includes(c.card)) })));
      } else if (e.type === "round") {
        later(at, () => {
          cbRef.current.onEvent?.(e);
          playCardShuffle();
          setPlayed((p) => ({ ...p, piles: [0, 0], table: e.table.map((card, i) => ({ card, phase: "in", from: { x: -130 + i * 6, y: 120 } })) }));
        });
        at += LAND_MS + PAUSE_MS;
      } else if (e.type === "deal") {
        later(at, () => {
          cbRef.current.onEvent?.(e);
          playCardShuffle();
        });
      } else {
        later(at, () => cbRef.current.onEvent?.(e));
      }
    }
    later(at + 40, () => setPlayed(final));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.eventSeq]);

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    [],
  );

  return played;
}
