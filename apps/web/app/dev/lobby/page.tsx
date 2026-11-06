"use client";

import { DEFAULT_DOMINO_OPTIONS, DEFAULT_LUDO_OPTIONS } from "@icosium/shared";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { WaitingRoom } from "@/components/domino/waiting-room";
import { LobbyView } from "@/components/lobby/lobby-view";
import { LudoWaitingRoom } from "@/components/ludo/waiting-room";
import type { LobbyTable } from "@/lib/lobby";

/**
 * Bac à sable : le lobby et les tables qui attendent, avec des tables d'exemple, sans base de données.
 * /dev/lobby, /dev/lobby?empty=1, /dev/lobby?room=domino, /dev/lobby?room=ludo
 */
export default function LobbySandbox() {
  if (process.env.NODE_ENV === "production") notFound();
  const [q, setQ] = useState<URLSearchParams | null>(null);
  useEffect(() => setQ(new URLSearchParams(window.location.search)), []);
  if (!q) return null;
  const room = q.get("room");
  const seat = (seat: number, userId: string, username: string) => ({ seat, userId, username, isBot: false });

  if (room === "domino")
    return (
      <WaitingRoom
        code="KQZT"
        tableId="dev"
        hostId="me"
        options={DEFAULT_DOMINO_OPTIONS}
        seats={[seat(0, "me", "Rayan"), seat(1, "f-bilal", "Bilal")]}
        mySeat={0}
        isHost
        addBots={async () => ({ ok: true, data: {} })}
      />
    );
  if (room === "ludo")
    return (
      <LudoWaitingRoom
        code="LMPX"
        tableId="dev"
        hostId="me"
        options={{ ...DEFAULT_LUDO_OPTIONS, players: 4 }}
        seats={[seat(0, "me", "Rayan"), seat(1, "f-yasmine", "Yasmine"), seat(2, "f-karim", "Karim")]}
        mySeat={0}
        isHost
        addBots={async () => ({ ok: true, data: {} })}
      />
    );

  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const tables: LobbyTable[] = q.get("empty")
    ? []
    : [
        {
          game: "domino", id: "1", code: "KQZT", hostId: "me", hostName: "Rayan", status: "playing", visibility: "friends", createdAt: ago(20), mine: true,
          options: { ...DEFAULT_DOMINO_OPTIONS }, seats: [seat(0, "me", "Rayan"), seat(1, "f-bilal", "Bilal"), seat(2, "x1", "Sofiane"), seat(3, "f-nadia", "Nadia")],
        },
        {
          game: "ludo", id: "2", code: "BHRW", hostId: "f-yasmine", hostName: "Yasmine", status: "waiting", visibility: "friends", createdAt: ago(2), mine: false,
          options: { ...DEFAULT_LUDO_OPTIONS, players: 4 }, seats: [seat(0, "f-yasmine", "Yasmine"), seat(1, "x2", "Walid")],
        },
        {
          game: "domino", id: "3", code: "PLMN", hostId: "x3", hostName: "Hakim", status: "waiting", visibility: "public", createdAt: ago(5), mine: false,
          options: { ...DEFAULT_DOMINO_OPTIONS, players: 4, targetScore: 150, turnSeconds: 15 }, seats: [seat(0, "x3", "Hakim"), seat(1, "x4", "Lamine"), seat(2, "x5", "Meriem")],
        },
        {
          game: "domino", id: "4", code: "TRSD", hostId: "x6", hostName: "Amel", status: "waiting", visibility: "public", createdAt: ago(9), mine: false,
          options: { ...DEFAULT_DOMINO_OPTIONS, players: 2 }, seats: [seat(0, "x6", "Amel")],
        },
      ];
  return (
    <>
      <main className="mx-auto max-w-xl px-4 pt-6 pb-[calc(8rem+env(safe-area-inset-bottom))]">
        <LobbyView tables={tables} failed={false} meId="me" friendIds={new Set(["f-bilal", "f-yasmine", "f-nadia"])} />
      </main>
      <BottomNav />
    </>
  );
}
