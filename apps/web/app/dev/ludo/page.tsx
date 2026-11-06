"use client";

import { type LudoState, applyLudoAction, applyLudoTimeout, createLudoGame, ludoPublicView, parseLudoOptions } from "@icosium/shared";
import { notFound } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LudoGame } from "@/components/ludo/game";
import { LudoWaitingRoom } from "@/components/ludo/waiting-room";
import type { CallResult, SeatInfo } from "@/lib/domino-client";
import type { LudoView } from "@/lib/ludo-client";

/**
 * Bac à sable de développement : une partie de Ludo jouée entièrement dans le navigateur (les
 * règles partagées jouent le rôle du serveur), pour vérifier l'écran, les animations et la fin de
 * partie sans base de données. Exemple : /dev/ludo?players=4&teams=1&win=1&me=2&auto=1
 */
export default function LudoSandbox() {
  if (process.env.NODE_ENV === "production") notFound();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? <Sandbox /> : null;
}

const NAMES = ["Toi", "Yasmine", "Karim", "Amine"];

function Sandbox() {
  const [cfg] = useState(() => {
    const q = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    const options = parseLudoOptions({
      players: Number(q.get("players") ?? 4),
      teams: q.get("teams") === "1",
      pawnsToWin: Number(q.get("win") ?? 4),
      turnSeconds: Number(q.get("secs") ?? 15),
    });
    const me = Math.min(options.players - 1, Number(q.get("me") ?? 0));
    const auto = q.get("auto") === "1";
    const bots = Array.from({ length: options.players }, (_, i) => i).filter((i) => auto || i !== me);
    return { options, me, bots, preset: q.get("preset"), waiting: q.get("waiting") === "1" };
  });
  const [state, setState] = useState<LudoState>(() => {
    const s = createLudoGame(cfg.options, () => (cfg.me + 0.5) / cfg.options.players, Date.now(), cfg.bots);
    if (cfg.preset === "busy") {
      // Une partie bien avancée, pour les captures d'écran : pions partout, quelques-uns rentrés.
      s.pawns = s.colors.map((_, seat) => [[5, 22, -1, 56], [12, 30, 40, -1], [53, 8, -1, -1], [47, 2, 56, -1]][seat] as number[]);
    }
    return s;
  });
  const view: LudoView = { ...ludoPublicView(state), sentAt: Date.now() };
  const seats: SeatInfo[] = state.colors.map((_, seat) => ({
    seat,
    userId: seat === cfg.me ? "me" : null,
    username: seat === cfg.me ? NAMES[0]! : (NAMES[seat === 0 ? cfg.me : seat] ?? `Bot ${seat}`),
    isBot: seat !== cfg.me,
  }));

  const ref = useRef(state);
  ref.current = state;
  const act = useCallback((fn: (s: LudoState) => ReturnType<typeof applyLudoAction>): CallResult => {
    const r = fn(ref.current);
    if (!r.ok) return { ok: false, error: r.error };
    ref.current = r.state;
    setState(r.state);
    return { ok: true, data: {} };
  }, []);
  const roll = useCallback(async () => act((s) => applyLudoAction(s, cfg.me, { type: "roll" }, Math.random, Date.now())), [act, cfg.me]);
  const move = useCallback(async (pawn: number) => act((s) => applyLudoAction(s, cfg.me, { type: "move", pawn }, Math.random, Date.now())), [act, cfg.me]);
  const tick = useCallback(async () => {
    act((s) => applyLudoTimeout(s, Math.random, Date.now()));
  }, [act]);
  useEffect(() => {
    document.title = "Ludo (dev)";
  }, []);

  if (cfg.waiting)
    return (
      <LudoWaitingRoom
        code="KQZT"
        tableId="dev"
        hostId="dev-host"
        options={cfg.options}
        seats={seats.slice(0, 2).map((x, i) => (i === 0 ? x : { ...x, isBot: false, userId: "u1", username: "Yasmine" }))}
        mySeat={cfg.me}
        isHost
        addBots={async () => ({ ok: true, data: {} })}
      />
    );
  return <LudoGame code="DEVX" view={view} seats={seats} mySeat={cfg.me} clockOffset={0} roll={roll} move={move} tick={tick} />;
}
