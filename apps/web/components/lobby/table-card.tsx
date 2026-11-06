"use client";

import Link from "next/link";
import { CrownIcon } from "@/components/cafe-icons";
import { GAMES, tablePath } from "@/lib/games";
import { useT } from "@/lib/i18n";
import { type LobbyTable, freeSeats } from "@/lib/lobby";
import { MiniTable } from "./mini-table";

/** Une table du lobby : la table en miniature, qui l'a ouverte, ses règles, et le bouton pour s'asseoir. */
export function TableCard({ table, friendIds, meId, index = 0 }: { table: LobbyTable; friendIds: Set<string>; meId: string | null; index?: number }) {
  const t = useT();
  const free = freeSeats(table);
  // Un ami assis (autre que le Patron, déjà nommé) ; sinon, si le Patron est un ami, on le dit autrement.
  const friend = table.seats.find((s) => s.userId && s.userId !== meId && s.userId !== table.hostId && friendIds.has(s.userId));
  const friendHost = !friend && friendIds.has(table.hostId);
  const iAmHost = table.hostId === meId;
  const playing = table.status === "playing";
  return (
    <Link
      href={tablePath(table.game, table.code)}
      className={`cafe-card animate-rise flex items-center gap-3 p-3 transition-transform duration-150 active:scale-[0.98] ${table.mine ? "!border-gold/55" : ""}`}
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
    >
      <MiniTable game={table.game} players={table.options.players} seats={table.seats} size={64} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="text-[0.66rem] font-bold tracking-[0.18em] text-gold uppercase">{t(GAMES[table.game].name)}</span>
          <span className="font-mono text-[0.7rem] tracking-[0.15em] text-cafe-muted" dir="ltr">
            {table.code}
          </span>
          {!playing && free > 0 && (
            <span className="ms-auto shrink-0 text-[0.68rem] text-cafe-muted">{free === 1 ? t("lobby.freeOne") : t("lobby.freeMany", { n: free })}</span>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 font-semibold">
          {iAmHost && <CrownIcon className="size-4 shrink-0 text-gold-light" />}
          <span className="truncate">{iAmHost ? t("lobby.yourTable") : t("lobby.tableOf", { name: table.hostName })}</span>
        </span>
        <span className="truncate text-xs text-cafe-muted">{summary(table, t)}</span>
        <span className="mt-1 flex items-center gap-2">
          <span className="min-w-0 flex-1">
            {(friend || friendHost) && !table.mine ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-online">
                <span className="size-1.5 shrink-0 rounded-full bg-online shadow-[0_0_6px_var(--icos-online)]" aria-hidden="true" />
                <span className="truncate">{friend ? t("lobby.friendSeated", { name: friend.username }) : t("lobby.friendHost")}</span>
              </span>
            ) : table.mine ? (
              <span className={`block truncate text-xs font-semibold ${playing ? "text-gold-light" : "text-cafe-muted"}`}>
                {playing ? t("lobby.statusPlaying") : t("lobby.statusWaiting")}
              </span>
            ) : null}
          </span>
          <span className={`flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-bold ${table.mine ? "cafe-panel text-gold-light" : "gold-button"}`}>
            {table.mine ? t("lobby.back") : t("lobby.sit")}
          </span>
        </span>
      </span>
    </Link>
  );
}

function summary(table: LobbyTable, t: ReturnType<typeof useT>): string {
  const o = table.options;
  const time = typeof o.turnSeconds === "number" && o.turnSeconds > 0 ? t("play.seconds", { n: o.turnSeconds }) : t("play.unlimited");
  if (table.game === "ludo") {
    const who = o.teams ? t("play.ludoTeams") : t(o.players === 2 ? "play.players2" : o.players === 3 ? "play.players3" : "play.ludoPlayers4");
    return `${who} · ${t("ludo.waiting.pawnsToWin", { n: Number(o.pawnsToWin ?? 4) })} · ${time}`;
  }
  return `${t(o.players === 2 ? "play.players2" : "play.players4")} · ${Number(o.targetScore ?? 100)} · ${time}`;
}
