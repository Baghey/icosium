"use client";

import type { MessageKey } from "@icosium/i18n";
import { useState } from "react";
import { BlockIcon, CloseIcon, FlagIcon } from "@/components/cafe-icons";
import { Sheet } from "@/components/sheet";
import { useT } from "@/lib/i18n";
import { blockUser, removeFriend, reportUser, useSocial } from "@/lib/social-context";
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
};

/**
 * Le menu d'une personne : retirer des amis, bloquer, signaler.
 * Accessible partout où l'on croise quelqu'un (liste d'amis, conversation).
 */
export function PersonActions({ id, name, isFriend, onClose, onBlocked }: Props) {
  const t = useT();
  const { refresh, presenceOf } = useSocial();
  const [mode, setMode] = useState<"menu" | "remove" | "block" | "report" | "done">("menu");
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
            void run(() => reportUser(id, text), "social.reported");
          }}
        >
          <p className="font-semibold">{t("social.reportTitle", { name })}</p>
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
