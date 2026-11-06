"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AddFriendIcon, ChevronDownIcon, CloseIcon, EyeIcon, WhatsAppIcon } from "@/components/cafe-icons";
import { Sheet } from "@/components/sheet";
import { InviteFriends } from "@/components/social/invite-friends";
import { GAMES, type GameId, tablePath } from "@/lib/games";
import { useT } from "@/lib/i18n";
import { type Visibility, VISIBILITIES, fetchVisibility, leaveTable, setTableVisibility } from "@/lib/lobby";

const VIS_LABEL = { public: "lobby.visPublic", friends: "lobby.visFriends", private: "lobby.visPrivate" } as const;
const VIS_HINT = { public: "lobby.visPublicHint", friends: "lobby.visFriendsHint", private: "lobby.visPrivateHint" } as const;

/**
 * « Appeler du monde » depuis la table qui attend : WhatsApp avec un message prêt (le jeu, les
 * places libres, le lien), le partage du téléphone, et l'invitation directe aux amis.
 */
export function CallSomeone({ game, code, players, free }: { game: GameId; code: string; players: number; free: number }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [inviting, setInviting] = useState(false);

  const link = () => `${window.location.origin}${tablePath(game, code)}`;
  const message = () =>
    free === 1 ? t("lobby.whatsappOne", { game: t(GAMES[game].name), code }) : t("lobby.whatsappMany", { game: t(GAMES[game].name), code, n: free });

  function whatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${message()}\n${link()}`)}`, "_blank", "noopener");
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text: message(), url: link() });
        return;
      } catch {
        // l'utilisateur a fermé le partage : on copie à la place
      }
    }
    await navigator.clipboard?.writeText(`${message()}\n${link()}`).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="flex w-full max-w-sm flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={whatsapp}
            disabled={free === 0}
            className="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-full border border-wa-light/60 bg-gradient-to-b from-wa to-wa-dark px-4 text-sm font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_6px_16px_rgb(0_0_0/0.4)] transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
          >
            <WhatsAppIcon className="size-5" />
            {t("lobby.whatsapp")}
          </button>
          <button
            type="button"
            onClick={() => void share()}
            className="gold-button min-h-touch flex-1 rounded-full px-4 text-sm font-bold transition-transform duration-150 active:scale-[0.97]"
          >
            {copied ? t("domino.copied") : t("domino.share")}
          </button>
        </div>
        {free > 0 && (
          <button
            type="button"
            onClick={() => setInviting(true)}
            className="cafe-panel flex min-h-touch items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-gold-light transition-transform duration-150 active:scale-[0.97]"
          >
            <AddFriendIcon className="size-5" />
            {t("social.inviteFriends")}
          </button>
        )}
      </div>
      {inviting && <InviteFriends game={game} code={code} players={players} free={free} onClose={() => setInviting(false)} />}
    </>
  );
}

/** Le Patron choisit qui voit sa table dans le lobby : une pastille discrète qui ouvre les trois choix. */
export function VisibilityPicker({ game, tableId }: { game: GameId; tableId: string }) {
  const t = useT();
  const [value, setValue] = useState<Visibility | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    void fetchVisibility(game, tableId).then((v) => alive && setValue(v ?? "friends"));
    return () => {
      alive = false;
    };
  }, [game, tableId]);
  // Place réservée pendant la lecture : rien ne saute à l'écran.
  if (!value) return <span className="block min-h-touch" aria-hidden="true" />;

  async function pick(v: Visibility) {
    const before = value;
    setValue(v);
    setOpen(false);
    if (!(await setTableVisibility(game, tableId, v))) setValue(before);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-touch items-center gap-2 rounded-full px-4 text-sm text-cafe-muted transition-colors duration-150 active:text-gold-light"
      >
        <EyeIcon className="size-5 text-gold" />
        <span>{t("lobby.visibleTo", { who: t(VIS_LABEL[value]) })}</span>
        <ChevronDownIcon className="size-4" />
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)} label={t("lobby.visibility")}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-gilded text-xl font-bold">{t("lobby.visibility")}</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")} className="flex size-touch items-center justify-center rounded-full text-cafe-muted">
              <CloseIcon className="size-5" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {VISIBILITIES.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={v === value}
                onClick={() => void pick(v)}
                className={`flex min-h-16 items-center gap-3 rounded-card border px-4 py-3 text-start transition-colors duration-150 ${
                  v === value ? "border-gold bg-gold/10" : "border-gold/20 bg-black/25"
                }`}
              >
                <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${v === value ? "border-gold" : "border-gold/40"}`}>
                  {v === value && <span className="size-2.5 rounded-full bg-gold" />}
                </span>
                <span className="flex flex-col">
                  <span className={`font-semibold ${v === value ? "text-gold-light" : ""}`}>{t(VIS_LABEL[v])}</span>
                  <span className="text-xs text-cafe-muted">{t(VIS_HINT[v])}</span>
                </span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}

export const visibilityLabel = (v: Visibility) => VIS_LABEL[v];
export const visibilityHint = (v: Visibility) => VIS_HINT[v];

/** « Quitter la table » : avant la partie, on libère sa chaise ; puis retour au lobby. */
export function useLeave(game: GameId, tableId: string) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  async function leave() {
    setLeaving(true);
    await leaveTable(game, tableId);
    router.push(game === "domino" ? "/play" : `/play?game=${game}`);
  }
  return { leave, leaving };
}
