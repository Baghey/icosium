"use client";

import type { MessageKey } from "@icosium/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AddFriendIcon, CheckIcon, CloseIcon, GroupIcon } from "@/components/cafe-icons";
import { Sheet } from "@/components/sheet";
import { useT } from "@/lib/i18n";
import { presenceKey } from "@/lib/social-format";
import { type GroupError, type Member, addGroupMembers, createGroup, leaveGroup, useSocial } from "@/lib/social-context";
import { PersonAvatar } from "./person-avatar";

export const GROUP_MAX = 8;

/** Avatar d'un groupe : deux visages qui se chevauchent, et le nombre de membres en plus. */
export function GroupAvatar({ members, size = 50 }: { members: Member[]; size?: number }) {
  const [a, b] = members;
  const small = Math.round(size * 0.68);
  const extra = members.length - 2;
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      {b ? (
        <>
          <span className="absolute end-0 top-0">
            <PersonAvatar id={b.id} size={small} />
          </span>
          <span className="absolute start-0 bottom-0 rounded-full ring-2 ring-cafe-1">
            <PersonAvatar id={a!.id} size={small} />
          </span>
          {extra > 0 && (
            <span className="absolute -end-1 -bottom-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-cafe-0 ring-2 ring-cafe-1">
              +{extra}
            </span>
          )}
        </>
      ) : a ? (
        <PersonAvatar id={a.id} size={size} />
      ) : (
        <span className="flex size-full items-center justify-center rounded-full border-2 border-gold/60 bg-cafe-2 text-gold-light">
          <GroupIcon className="size-1/2" />
        </span>
      )}
    </span>
  );
}

const GROUP_ERRORS: Record<GroupError, MessageKey> = {
  invalid_title: "social.group.error.invalid_title",
  invalid_members: "social.group.error.invalid_members",
  not_friends: "social.group.error.not_friends",
  rate_limited: "social.group.error.rate_limited",
  group_full: "social.group.error.group_full",
  network: "social.error.network",
  error: "social.error.error",
};

/** Choisir des amis (cases à cocher avec avatars). */
function FriendPicker({ exclude, picked, onToggle, max }: { exclude: Set<string>; picked: Set<string>; onToggle: (id: string) => void; max: number }) {
  const t = useT();
  const { friends, presenceOf } = useSocial();
  const list = friends.filter((f) => f.status === "accepted" && !exclude.has(f.id)).sort((x, y) => x.username.localeCompare(y.username));
  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-sm text-cafe-muted">{t("social.group.noFriendsLeft")}</p>
        <Link href="/friends?tab=friends" className="gold-button flex min-h-touch items-center gap-2 rounded-full px-5 text-sm font-bold">
          <AddFriendIcon className="size-5" />
          {t("home.findFriends")}
        </Link>
      </div>
    );
  }
  return (
    <ul className="flex max-h-[40dvh] flex-col overflow-y-auto">
      {list.map((f) => {
        const on = picked.has(f.id);
        const full = !on && picked.size >= max;
        const p = presenceOf(f.id);
        return (
          <li key={f.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={full}
              onClick={() => onToggle(f.id)}
              className="flex min-h-16 w-full items-center gap-3 rounded-control px-2 text-start transition-colors duration-150 active:bg-white/5 disabled:opacity-40"
            >
              <PersonAvatar id={f.id} size={42} presence={p} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{f.username}</span>
                <span className={`text-xs ${p ? "text-online" : "text-cafe-muted"}`}>{t(presenceKey(p))}</span>
              </span>
              <span
                className={`flex size-7 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                  on ? "scale-100 border-gold bg-gold text-cafe-0" : "scale-90 border-gold/40 text-transparent"
                }`}
              >
                <CheckIcon className="size-4" />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Nouveau groupe : un nom et des amis. */
export function NewGroupSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const { refresh } = useSocial();
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createGroup(title.trim(), [...picked]);
    setBusy(false);
    if (!res.ok) {
      setError(GROUP_ERRORS[res.error]);
      return;
    }
    await refresh();
    onClose();
    router.push(`/friends/${res.id}`);
  }

  return (
    <Sheet onClose={onClose} label={t("social.group.new")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-gilded text-xl font-bold">{t("social.group.new")}</h2>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex size-touch items-center justify-center rounded-full text-cafe-muted">
            <CloseIcon className="size-5" />
          </button>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="section-title">{t("social.group.name")}</span>
          <input
            value={title}
            maxLength={40}
            required
            placeholder={t("social.group.namePlaceholder")}
            onChange={(e) => setTitle(e.target.value)}
            className="cafe-input min-h-touch px-3"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="section-title flex justify-between">
            <span>{t("social.group.pick")}</span>
            <span className="text-cafe-muted tabular-nums">
              {picked.size}/{GROUP_MAX - 1}
            </span>
          </span>
          <FriendPicker exclude={new Set()} picked={picked} onToggle={toggle} max={GROUP_MAX - 1} />
        </div>
        {error && (
          <p role="alert" className="animate-fade text-sm text-danger">
            {t(error)}
          </p>
        )}
        <button type="submit" disabled={busy || !title.trim() || picked.size === 0} className="gold-button min-h-touch rounded-control font-bold disabled:opacity-50">
          {t("social.group.create")}
        </button>
      </form>
    </Sheet>
  );
}

/** Infos d'un groupe : membres, ajouter des amis, quitter. */
export function GroupInfoSheet({ id, title, members, onClose }: { id: string; title: string; members: Member[]; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const { refresh, presenceOf } = useSocial();
  const [mode, setMode] = useState<"info" | "add" | "leave">("info");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const room = GROUP_MAX - 1 - members.length;

  async function add() {
    setBusy(true);
    const err = await addGroupMembers(id, [...picked]);
    setBusy(false);
    if (err) {
      setError(GROUP_ERRORS[err]);
      return;
    }
    await refresh();
    onClose();
  }

  async function leave() {
    setBusy(true);
    await leaveGroup(id);
    await refresh();
    router.replace("/friends");
  }

  return (
    <Sheet onClose={onClose} label={title}>
      <div className="mb-4 flex items-center gap-3">
        <GroupAvatar members={members} size={48} />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-lg font-bold">{title}</p>
          <p className="text-xs text-cafe-muted">{t("social.group.count", { n: members.length + 1 })}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex size-touch items-center justify-center rounded-full text-cafe-muted">
          <CloseIcon className="size-5" />
        </button>
      </div>

      {mode === "info" && (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col divide-y divide-gold/10">
            {members.map((m) => {
              const p = presenceOf(m.id);
              return (
                <li key={m.id} className="flex min-h-14 items-center gap-3 py-1.5">
                  <PersonAvatar id={m.id} size={38} presence={p} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{m.username}</span>
                  <span className={`text-xs ${p ? "text-online" : "text-cafe-muted"}`}>{t(presenceKey(p))}</span>
                </li>
              );
            })}
          </ul>
          {room > 0 && (
            <button type="button" onClick={() => setMode("add")} className="flex min-h-touch items-center justify-center gap-2 rounded-control border border-gold/40 bg-gold/10 font-bold text-gold-light">
              <AddFriendIcon className="size-5" />
              {t("social.group.add")}
            </button>
          )}
          <button type="button" onClick={() => setMode("leave")} className="min-h-touch rounded-control font-semibold text-danger active:bg-white/5">
            {t("social.group.leave")}
          </button>
        </div>
      )}

      {mode === "add" && (
        <div className="flex flex-col gap-3">
          <FriendPicker
            exclude={new Set(members.map((m) => m.id))}
            picked={picked}
            max={room}
            onToggle={(fid) =>
              setPicked((prev) => {
                const next = new Set(prev);
                if (next.has(fid)) next.delete(fid);
                else next.add(fid);
                return next;
              })
            }
          />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {t(error)}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode("info")} className="min-h-touch flex-1 rounded-control border border-gold/30 font-semibold">
              {t("social.cancel")}
            </button>
            <button type="button" disabled={busy || picked.size === 0} onClick={() => void add()} className="gold-button min-h-touch flex-1 rounded-control font-bold disabled:opacity-50">
              {t("social.group.addConfirm", { n: picked.size })}
            </button>
          </div>
        </div>
      )}

      {mode === "leave" && (
        <div className="flex flex-col gap-4">
          <p>{t("social.group.confirmLeave", { title })}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode("info")} className="min-h-touch flex-1 rounded-control border border-gold/30 font-semibold">
              {t("social.cancel")}
            </button>
            <button type="button" disabled={busy} onClick={() => void leave()} className="min-h-touch flex-1 rounded-control bg-danger font-bold text-cafe-0 disabled:opacity-60">
              {t("social.group.leave")}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
