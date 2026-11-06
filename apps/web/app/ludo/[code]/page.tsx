"use client";

import type { MessageKey } from "@icosium/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect } from "react";
import { LudoGame } from "@/components/ludo/game";
import { LudoWaitingRoom } from "@/components/ludo/waiting-room";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";
import { useLudoTable } from "@/lib/use-ludo-table";
import { useVoice } from "@/lib/voice-context";

const JOIN_ERRORS: Record<string, MessageKey> = {
  invalid_code: "play.error.invalid_code",
  table_not_found: "play.error.table_not_found",
  table_full: "play.error.table_full",
  table_started: "play.error.table_started",
  seat_taken: "play.error.seat_taken",
  kicked: "play.error.kicked",
};

export default function LudoTablePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = use(params);
  const code = raw.toUpperCase();
  const t = useT();
  const router = useRouter();
  const { ready, user } = useAuth();
  const table = useLudoTable(code);
  const voice = useVoice();

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=/ludo/${code}`);
  }, [ready, user, router, code]);

  // Le salon vocal de la table : on y entre micro coupé, et on y revient seul après une coupure.
  // Seul avec des bots : pas besoin de salon vocal.
  const seated = table.mySeat !== null && !(table.seats.length > 1 && table.seats.every((s) => s.isBot || s.userId === user?.id));
  const room = `ludo-${code.toLowerCase()}`;
  const { status, roomName, error, join } = voice;
  useEffect(() => {
    if (!seated || error === "full" || error === "micDenied") return;
    if (status === "idle" && roomName !== room) {
      const id = window.setTimeout(() => void join(room), error ? 4000 : 0);
      return () => window.clearTimeout(id);
    }
  }, [seated, status, roomName, room, error, join]);

  if (!ready || !user || table.loading) {
    return <Centered>{t("ludo.loading")}</Centered>;
  }
  if (table.joinError || table.mySeat === null || !table.table) {
    return (
      <Centered>
        <p className="mb-4">{t(table.joinError ? (JOIN_ERRORS[table.joinError] ?? "play.error.unknown") : "play.error.removed")}</p>
        <Link href="/play?game=ludo" className="inline-flex min-h-touch items-center rounded-control bg-mint px-5 font-semibold text-mint-ink">
          {t("nav.play")}
        </Link>
      </Centered>
    );
  }

  if (!table.view) {
    return (
      <LudoWaitingRoom
        code={code}
        options={table.table.options}
        seats={table.seats}
        mySeat={table.mySeat}
        isHost={table.table.hostId === user.id}
        tableId={table.table.id}
        hostId={table.table.hostId}
        addBots={table.addBots}
        onSeatsChanged={() => void table.refreshSeats()}
      />
    );
  }

  return (
    <LudoGame
      code={code}
      view={table.view}
      seats={table.seats}
      mySeat={table.mySeat}
      clockOffset={table.clockOffset}
      roll={table.roll}
      move={table.move}
      tick={table.tick}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="ludo-bg flex min-h-[70dvh] flex-col items-center justify-center p-6 text-center text-ink-muted">{children}</div>;
}
