"use client";

import { tableAvatars } from "@/components/domino/player-badge";
import { DominoTile } from "@/components/domino/tile";
import { type SeatInfo, seatKey } from "@/lib/domino-client";
import type { GameId } from "@/lib/games";

/**
 * La table vue d'en haut, en miniature : le feutre (domino) ou le plateau aux quatre couleurs (Ludo),
 * et les chaises autour, avec l'avatar de chaque personne assise et des chaises vides en pointillés.
 */
export function MiniTable({ game, players, seats, size = 84 }: { game: GameId; players: number; seats: SeatInfo[]; size?: number }) {
  const avatars = tableAvatars(seats.map((s) => ({ key: seatKey(s), botName: s.userId ? null : s.username })));
  const chair = Math.round(size * 0.34);
  const radius = size / 2 - chair * 0.18;
  return (
    <div className="relative shrink-0" style={{ width: size + chair * 0.6, height: size + chair * 0.6 }} aria-hidden="true">
      <div className="absolute inset-0 m-auto" style={{ width: size * 0.78, height: size * 0.78 }}>
        {game === "ludo" ? <LudoTop /> : <FeltTop />}
      </div>
      {Array.from({ length: players }, (_, seat) => {
        // Chaise 0 en bas, puis dans le sens des aiguilles d'une montre.
        const angle = Math.PI / 2 + (seat * 2 * Math.PI) / players;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const who = seats.find((s) => s.seat === seat);
        return (
          <span
            key={who ? seatKey(who) : `free-${seat}`}
            className={`absolute top-1/2 left-1/2 flex items-center justify-center overflow-hidden rounded-full ${
              who ? "animate-seat border-2 border-gold shadow-[0_2px_8px_rgb(0_0_0/0.55)]" : "border border-dashed border-gold/50 bg-cafe-0/70"
            }`}
            style={{ width: chair, height: chair, transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {who && <img src={avatars[seatKey(who)]} alt="" className="size-full object-cover" />}
          </span>
        );
      })}
    </div>
  );
}

/** Feutre vert émeraude, rebord en noyer et filet doré, deux pierres posées. */
function FeltTop() {
  return (
    <div
      className="flex size-full items-center justify-center rounded-full"
      style={{
        background: "radial-gradient(75% 70% at 45% 40%, var(--felt-light), var(--felt) 55%, var(--felt-dark))",
        boxShadow: "inset 0 0 0 1.5px color-mix(in srgb, var(--gold) 70%, transparent), 0 0 0 4px var(--walnut), 0 0 0 5px var(--walnut-light), 0 6px 14px rgb(0 0 0 / 0.55)",
      }}
    >
      <span className="flex rotate-[-18deg] gap-[2px] drop-shadow-[0_2px_2px_rgb(0_0_0/0.5)]" dir="ltr">
        <DominoTile a={6} b={6} orientation="vertical" size={7} />
        <DominoTile a={6} b={2} orientation="vertical" size={7} />
      </span>
    </div>
  );
}

/** Plateau de Ludo en zellige : quatre maisons de couleur et le centre doré. */
function LudoTop() {
  return (
    <div
      className="relative size-full overflow-hidden rounded-[22%]"
      style={{ boxShadow: "inset 0 0 0 1.5px color-mix(in srgb, var(--gold) 70%, transparent), 0 0 0 4px var(--walnut), 0 0 0 5px var(--walnut-light), 0 6px 14px rgb(0 0 0 / 0.55)" }}
    >
      <div className="grid size-full grid-cols-2 grid-rows-2 bg-ludo-ivory">
        <span className="m-[12%] rounded-[30%] bg-ludo-red" />
        <span className="m-[12%] rounded-[30%] bg-ludo-green" />
        <span className="m-[12%] rounded-[30%] bg-ludo-blue" />
        <span className="m-[12%] rounded-[30%] bg-ludo-yellow" />
      </div>
      <span className="absolute inset-0 m-auto size-[28%] rotate-45 rounded-[3px] border border-gold-dark bg-gradient-to-br from-gold-light to-gold-dark" />
    </div>
  );
}
