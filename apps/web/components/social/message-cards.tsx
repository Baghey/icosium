"use client";

import Link from "next/link";
import { CrownIcon, DominoIcon, PhoneIcon, TrophyIcon } from "@/components/cafe-icons";
import { useI18n } from "@/lib/i18n";
import type { InviteMeta } from "@/lib/social-context";
import { formatSeconds } from "./voice-note";

/** Résultat d'une partie, posté par le serveur. */
export type ResultMeta = {
  game: "domino";
  code: string;
  players: number;
  scores: [number, number];
  winnerTeam: 0 | 1;
  target?: number;
  teams: [{ id: string | null; name: string; bot: boolean }[], { id: string | null; name: string; bot: boolean }[]];
};
export type CallMeta = { status: "ended" | "missed" | "declined"; duration: number };
export type SystemMeta = { event: "created" | "added" | "left"; actor: string; actorName: string; title?: string; names?: string[] };

/** Invitation à une table : une carte en feutre avec le code et un bouton Rejoindre. */
export function InviteCard({ meta, corners }: { meta: InviteMeta; corners: string }) {
  const { t } = useI18n();
  return (
    <div className={`animate-pop w-64 max-w-[78vw] overflow-hidden rounded-[1.25rem] ${corners} border border-gold/50 shadow-[0_8px_20px_rgb(0_0_0/0.4)]`}>
      <div className="felt-table felt-grain flex items-center gap-3 !border-0 p-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-black/35 text-gold-light ring-1 ring-gold/50">
          <DominoIcon className="size-6" />
        </span>
        <span className="flex flex-col">
          <span className="text-gilded font-bold">{t("social.inviteCard")}</span>
          <span className="font-mono text-lg font-bold tracking-[0.3em] text-cafe-text" dir="ltr">
            {meta.code}
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 bg-cafe-1/95 px-3 py-2">
        <span className="text-xs text-cafe-muted">{t("social.inviteSeats", { free: meta.free })}</span>
        <Link href={`/play/${meta.code}`} className="gold-button flex min-h-touch items-center rounded-full px-5 text-sm font-bold">
          {t("social.inviteJoin")}
        </Link>
      </div>
    </div>
  );
}

/**
 * Fin de partie : une plaque de feutre avec les deux équipes, le score, et la couronne
 * sur les vainqueurs.
 */
export function ResultCard({ meta, me }: { meta: ResultMeta; me: string }) {
  const { t } = useI18n();
  const iWon = meta.teams[meta.winnerTeam]?.some((p) => p.id === me) ?? false;
  const played = meta.teams.some((team) => team.some((p) => p.id === me));
  const order = [meta.winnerTeam, meta.winnerTeam === 0 ? 1 : 0] as const;
  return (
    <div className="animate-pop mx-auto w-72 max-w-[86vw] overflow-hidden rounded-[1.4rem] border border-gold/60 shadow-[0_12px_28px_rgb(0_0_0/0.5)]">
      <div className="felt-table felt-grain relative flex flex-col items-center gap-1 !border-0 px-4 pt-4 pb-3 text-center">
        <span aria-hidden="true" className="absolute inset-x-6 top-2 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
        <span className="flex size-12 items-center justify-center rounded-full bg-black/35 text-gold-light ring-1 ring-gold/60">
          <TrophyIcon className="size-6" />
        </span>
        <span className="text-[11px] font-semibold tracking-[0.25em] text-gold-light/80 uppercase">{t("social.result.title")}</span>
        <span className="text-gilded text-xl font-bold">
          {played ? (iWon ? t("social.result.youWon") : t("social.result.youLost")) : t("social.result.finished")}
        </span>
      </div>
      <ul className="flex flex-col bg-cafe-1/95">
        {order.map((team, i) => {
          const winner = i === 0;
          return (
            <li key={team} className={`flex items-center gap-3 px-4 py-2.5 ${winner ? "bg-gold/10" : "border-t border-gold/10"}`}>
              <span className={`flex size-6 items-center justify-center ${winner ? "text-gold-light" : "text-transparent"}`} aria-hidden={!winner}>
                <CrownIcon className="size-5" />
              </span>
              <span className={`min-w-0 flex-1 truncate text-sm ${winner ? "font-bold text-cafe-text" : "text-cafe-muted"}`}>
                {meta.teams[team]?.map((p) => p.name).join(" & ")}
              </span>
              <span className={`text-lg font-bold tabular-nums ${winner ? "text-gilded" : "text-cafe-muted"}`}>{meta.scores[team]}</span>
            </li>
          );
        })}
      </ul>
      <p className="bg-cafe-0/95 px-4 py-1.5 text-center text-[11px] text-cafe-muted">
        {t("social.result.footer", { target: meta.target ?? 100, code: meta.code })}
      </p>
    </div>
  );
}

/** Trace d'un appel : durée, manqué ou refusé, avec « Rappeler ». */
export function CallLine({ meta, mine, onCallBack }: { meta: CallMeta; mine: boolean; onCallBack?: () => void }) {
  const { t } = useI18n();
  const missed = meta.status !== "ended";
  const label =
    meta.status === "ended"
      ? t("social.call.ended", { duration: formatSeconds(meta.duration) })
      : meta.status === "declined"
        ? t("social.call.declined")
        : mine
          ? t("social.call.noAnswer")
          : t("social.call.missed");
  return (
    <div className="animate-fade mx-auto flex items-center gap-2 rounded-full border border-gold/20 bg-cafe-1/85 py-1 ps-1 pe-1 text-sm shadow-md">
      <span className={`flex size-8 items-center justify-center rounded-full ${missed ? "bg-[#d9472f]/20 text-danger" : "bg-mic-on/20 text-online"}`}>
        <PhoneIcon className={`size-4 ${missed ? "rotate-[135deg]" : ""}`} />
      </span>
      <span className="pe-1 font-semibold">{label}</span>
      {onCallBack && (
        <button type="button" onClick={onCallBack} className="min-h-touch rounded-full bg-gold/15 px-3 text-xs font-bold text-gold-light active:bg-gold/25">
          {t("social.call.callBack")}
        </button>
      )}
    </div>
  );
}

/** « Amine a créé le groupe », « … a ajouté … », « … est parti ». */
export function SystemLine({ meta }: { meta: SystemMeta }) {
  const { t } = useI18n();
  const text =
    meta.event === "created"
      ? t("social.system.created", { name: meta.actorName, title: meta.title ?? "" })
      : meta.event === "added"
        ? t("social.system.added", { name: meta.actorName, names: (meta.names ?? []).join(", ") })
        : t("social.system.left", { name: meta.actorName });
  return <p className="animate-fade mx-auto max-w-[85%] text-center text-xs text-cafe-muted">{text}</p>;
}
