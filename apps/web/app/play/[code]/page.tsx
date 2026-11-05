"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DominoGame } from "@/components/domino/game";
import { WaitingRoom } from "@/components/domino/waiting-room";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";
import { useDominoTable } from "@/lib/use-domino-table";
import { useVoice } from "@/lib/voice-context";
import type { MessageKey } from "@icosium/i18n";

const JOIN_ERRORS: Record<string, MessageKey> = {
  invalid_code: "play.error.invalid_code",
  table_not_found: "play.error.table_not_found",
  table_full: "play.error.table_full",
  table_started: "play.error.table_started",
  seat_taken: "play.error.seat_taken",
};

export default function TablePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = use(params);
  const code = raw.toUpperCase();
  const t = useT();
  const router = useRouter();
  const { ready, user } = useAuth();
  const table = useDominoTable(code);
  const voice = useVoice();

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=/play/${code}`);
  }, [ready, user, router, code]);

  // Le salon vocal de la table : on y entre micro coupé, et on y revient seul après une coupure.
  const seated = table.mySeat !== null;
  const room = `table-${code.toLowerCase()}`;
  const { status, roomName, error, join } = voice;
  useEffect(() => {
    if (!seated || error === "full" || error === "micDenied") return;
    if (status === "idle" && roomName !== room) {
      const id = window.setTimeout(() => void join(room), error ? 4000 : 0);
      return () => window.clearTimeout(id);
    }
  }, [seated, status, roomName, room, error, join]);

  if (!ready || !user || table.loading) {
    return <Centered>{t("domino.loading")}</Centered>;
  }
  if (table.joinError || table.mySeat === null || !table.table) {
    return (
      <Centered>
        <p className="mb-4">{t(JOIN_ERRORS[table.joinError ?? ""] ?? "play.error.unknown")}</p>
        <Link href="/play" className="inline-flex min-h-touch items-center rounded-control bg-mint px-5 font-semibold text-mint-ink">
          {t("nav.play")}
        </Link>
      </Centered>
    );
  }

  if (!table.view) {
    return <WaitingRoom code={code} options={table.table.options} seats={table.seats} mySeat={table.mySeat} />;
  }

  return (
    <DominoGame
      code={code}
      view={table.view}
      seats={table.seats}
      mySeat={table.mySeat}
      hand={table.hand}
      clockOffset={table.clockOffset}
      play={table.play}
      tick={table.tick}
      nextRound={table.nextRound}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[70dvh] flex-col items-center justify-center p-6 text-center text-ink-muted">{children}</div>;
}
