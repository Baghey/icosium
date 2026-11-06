"use client";

import type { MessageKey } from "@icosium/i18n";
import { useState } from "react";
import { AddFriendIcon, BlockIcon, CheckIcon, CloseIcon, FlagIcon, SpeakerIcon, SpeakerOffIcon } from "@/components/cafe-icons";
import { Sheet } from "@/components/sheet";
import { useT } from "@/lib/i18n";
import { blockUser, removeFriend, reportUser, sendFriendRequest, useSocial } from "@/lib/social-context";
import { useVoice } from "@/lib/voice-context";
import { PersonAvatar } from "./person-avatar";

const REASONS = ["spam", "insult", "cheat", "other"] as const;
type Reason = (typeof REASONS)[number];

type Props = {
  id: string;
  name: string;
  isFriend: boolean;
  onClose: () => void;
  /** Après un blocage (la conversation disparaît, on peut quitter la page). */
  onBlocked?: () => void;
  /** Ouvrir directement le signalement (d'un message précis, par exemple). */
  initialMode?: "menu" | "report";
  messageId?: string;
  /** À la table : proposer aussi « Ajouter en ami » et « Couper son micro pour moi ». */
  atTable?: boolean;
};

/**
 * Le menu d'une personne : retirer des amis, bloquer, signaler.
 * Accessible partout où l'on croise quelqu'un (liste d'amis, conversation).
 */
export function PersonActions({ id, name, isFriend, onClose, onBlocked, initialMode = "menu", messageId, atTable = false }: Props) {
  const t = useT();
  const { refresh, presenceOf, friends } = useSocial();
  const { silenced, setSilenced, peers } = useVoice();
  const [mode, setMode] = useState<"menu" | "remove" | "block" | "report" | "done">(initialMode);
  const pending = friends.some((f) => f.id === id && f.status === "pending");
  const [asked, setAsked] = useState(false);
  const inVoice = peers.some((p) => p.identity === id);
  const muted = silenced.has(id);
  const [done, setDone] = useState<MessageKey>("social.reported");
  const [reason, setReason] = useState<Reason>("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, message: MessageKey, after?: () => void) {
    setBusy(true);
    await action();
    await refresh();
    setBusy(false);
    setDone(message);
    setMode("done");
    after?.();
  }

  const row =
    "flex min-h-14 w-full items-center gap-3 rounded-control px-3 text-start font-semibold transition-colors duration-150 hover:bg-white/5 active:bg-white/10";

  return (
    <Sheet onClose={onClose} label={name}>
      <div className="mb-4 flex items-center gap-3">
        <PersonAvatar id={id} size={44} presence={presenceOf(id)} />
        <p className="min-w-0 flex-1 truncate text-lg font-bold">{name}</p>
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex size-touch items-center justify-center rounded-full text-cafe-muted">
          <CloseIcon className="size-5" />
        </button>
      </div>

      {mode === "menu" && (
        <div className="flex flex-col">
          {atTable && !isFriend && (
            <button
              type="button"
              className={`${row} text-gold-light`}
              disabled={pending || asked}
              onClick={() => {
                setAsked(true);
                void sendFriendRequest(name).then(refresh);
              }}
            >
              {pending || asked ? <CheckIcon className="size-5" /> : <AddFriendIcon className="size-5" />}
              {t(pending || asked ? "social.add.sentShort" : "social.addFriend")}
            </button>
          )}
          {atTable && inVoice && (
            <button type="button" className={row} onClick={() => setSilenced(id, !muted)}>
              {muted ? <SpeakerIcon className="size-5 text-cafe-muted" /> : <SpeakerOffIcon className="size-5 text-cafe-muted" />}
              <span className="flex flex-col">
                {t(muted ? "social.unsilence" : "social.silence")}
                <span className="text-xs font-normal text-cafe-muted">{t("social.silenceHint")}</span>
              </span>
            </button>
          )}
          {isFriend && (
            <button type="button" className={row} onClick={() => setMode("remove")}>
              <CloseIcon className="size-5 text-cafe-muted" />
              {t("social.remove")}
            </button>
          )}
          <button type="button" className={`${row} text-danger`} onClick={() => setMode("block")}>
            <BlockIcon className="size-5" />
            {t("social.block")}
          </button>
          <button type="button" className={`${row} text-danger`} onClick={() => setMode("report")}>
            <FlagIcon className="size-5" />
            {t("social.report")}
          </button>
        </div>
      )}

      {(mode === "remove" || mode === "block") && (
        <div className="flex flex-col gap-4">
          <p className="text-cafe-text/90">{t(mode === "remove" ? "social.confirmRemove" : "social.confirmBlock", { name })}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode("menu")} className="min-h-touch flex-1 rounded-control border border-gold/30 font-semibold">
              {t("social.cancel")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void (mode === "remove"
                  ? run(() => removeFriend(id), "social.blockedDone", onClose)
                  : run(() => blockUser(id), "social.blockedDone", onBlocked))
              }
              className="min-h-touch flex-1 rounded-control bg-danger font-bold text-cafe-0 disabled:opacity-60"
            >
              {t(mode === "remove" ? "social.remove" : "social.block")}
            </button>
          </div>
        </div>
      )}

      {mode === "report" && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const text = `${reason}${details.trim() ? `: ${details.trim()}` : ""}`;
            void run(() => reportUser(id, text, messageId), "social.reported");
          }}
        >
          <p className="font-semibold">{t(messageId ? "social.reportMessageTitle" : "social.reportTitle", { name })}</p>
          <div className="grid grid-cols-2 gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={reason === r}
                onClick={() => setReason(r)}
                className={`min-h-touch rounded-control border px-2 text-sm font-semibold transition-colors duration-150 ${
                  reason === r ? "border-gold bg-gold/15 text-gold-light" : "border-gold/25 text-cafe-muted"
                }`}
              >
                {t(`social.reportReason.${r}`)}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="report-details">
            {t("social.reportDetails")}
          </label>
          <textarea
            id="report-details"
            value={details}
            maxLength={400}
            rows={3}
            placeholder={t("social.reportDetails")}
            onChange={(e) => setDetails(e.target.value)}
            className="cafe-input resize-none p-3 text-sm"
          />
          <button type="submit" disabled={busy} className="min-h-touch rounded-control bg-danger font-bold text-cafe-0 disabled:opacity-60">
            {t("social.reportSend")}
          </button>
        </form>
      )}

      {mode === "done" && (
        <div className="flex flex-col gap-4">
          <p role="status" className="animate-fade text-cafe-text/90">
            {t(done, { name })}
          </p>
          <button type="button" onClick={onClose} className="gold-button min-h-touch rounded-control font-bold">
            {t("common.close")}
          </button>
        </div>
      )}
    </Sheet>
  );
}
