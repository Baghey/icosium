"use client";

import Link from "next/link";
import { useState } from "react";
import { AddFriendIcon, CheckIcon, CloseIcon } from "@/components/cafe-icons";
import { Sheet } from "@/components/sheet";
import { useT } from "@/lib/i18n";
import { presenceKey } from "@/lib/social-format";
import { openConversation, sendMessage, useSocial } from "@/lib/social-context";
import { PersonAvatar } from "./person-avatar";

/** Depuis la table d'attente : envoyer le code de la table à des amis, en un geste. */
export function InviteFriends({ code, players, free, onClose, game = "domino" }: { code: string; players: number; free: number; onClose: () => void; game?: "domino" | "ludo" }) {
  const t = useT();
  const { friends, presenceOf } = useSocial();
  const [state, setState] = useState<Record<string, "busy" | "done" | "error">>({});
  const list = friends
    .filter((f) => f.status === "accepted")
    .sort((a, b) => Number(!!presenceOf(b.id)) - Number(!!presenceOf(a.id)) || a.username.localeCompare(b.username));

  async function invite(id: string) {
    setState((s) => ({ ...s, [id]: "busy" }));
    const conv = await openConversation(id);
    const res = conv ? await sendMessage(conv, "", { game, code, players, free }) : null;
    setState((s) => ({ ...s, [id]: res?.ok ? "done" : "error" }));
  }

  return (
    <Sheet onClose={onClose} label={t("social.inviteFriends")}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-gilded text-xl font-bold">{t("social.inviteFriends")}</h2>
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex size-touch items-center justify-center rounded-full text-cafe-muted">
          <CloseIcon className="size-5" />
        </button>
      </div>
      <p className="mb-4 text-sm text-cafe-muted">{t("social.inviteHint")}</p>
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-cafe-muted">{t("social.noFriends")}</p>
          <Link href="/friends?tab=friends" className="gold-button flex min-h-touch items-center gap-2 rounded-full px-5 text-sm font-bold">
            <AddFriendIcon className="size-5" />
            {t("home.findFriends")}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-gold/10">
          {list.map((f) => {
            const p = presenceOf(f.id);
            const s = state[f.id];
            return (
              <li key={f.id} className="flex min-h-16 items-center gap-3 py-2">
                <PersonAvatar id={f.id} size={42} presence={p} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{f.username}</span>
                  <span className={`text-xs ${p ? "text-online" : "text-cafe-muted"}`}>{t(presenceKey(p))}</span>
                </span>
                <button
                  type="button"
                  disabled={s === "busy" || s === "done"}
                  onClick={() => void invite(f.id)}
                  className={`flex min-h-touch min-w-24 items-center justify-center gap-1 rounded-full px-4 text-sm font-bold transition-all duration-200 ${
                    s === "done" ? "bg-online/15 text-online ring-1 ring-online/50" : s === "error" ? "border border-danger text-danger" : "gold-button active:scale-95"
                  } disabled:cursor-default`}
                >
                  {s === "done" && <CheckIcon className="size-4" />}
                  {s === "done" ? t("social.invited") : s === "error" ? t("common.retry") : t("social.invite")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
