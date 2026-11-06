"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon, HangUpIcon, PhoneIcon } from "@/components/cafe-icons";
import { MicButton } from "@/components/mic-button";
import { useCall } from "@/lib/call-context";
import { useT } from "@/lib/i18n";
import { useVoice } from "@/lib/voice-context";
import { PersonAvatar } from "./person-avatar";

/** « 1:07 » depuis le décroché. */
export function useCallClock(since: number | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [since]);
  if (since === null) return "0:00";
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * L'écran d'appel, par-dessus tout : il sonne (décrocher / refuser), ça sonne chez l'autre
 * (raccrocher), ou l'appel est en cours (micro, raccrocher, réduire). Réduit, l'appel continue
 * et la barre vocale en haut le rappelle.
 */
export function CallScreen() {
  const t = useT();
  const { call, expanded, setExpanded, accept, decline, hangUp, error, clearError } = useCall();
  const { peers, micOn } = useVoice();
  const clock = useCallClock(call?.phase === "active" ? call.answeredAt : null);

  // Une erreur (occupé, pas amis…) s'affiche un instant puis s'efface.
  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(clearError, 3500);
    return () => window.clearTimeout(id);
  }, [error, clearError]);

  if (error && !call) {
    return (
      <div role="alert" className="animate-sheet fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-sm rounded-card border border-gold/40 bg-cafe-1/95 px-4 py-3 text-center text-sm shadow-xl backdrop-blur">
        {t(`call.error.${error}`)}
      </div>
    );
  }
  if (!call || !expanded) return null;

  const other = peers.find((p) => p.identity === call.otherId);
  const otherSpeaking = Boolean(other?.isSpeaking && other.micOn);
  const incoming = call.role === "callee" && call.phase === "ringing";
  const status =
    call.phase === "active"
      ? clock
      : call.phase === "connecting"
        ? t("call.connecting")
        : incoming
          ? t("call.incoming")
          : t("call.ringing");

  return (
    <div role="dialog" aria-modal="true" aria-label={t("call.with", { name: call.otherName })} className="animate-fade fixed inset-0 z-[60] flex flex-col overflow-hidden text-cafe-text">
      {/* Le café de nuit, flouté, avec une lueur de lampe au-dessus de l'avatar. */}
      <div aria-hidden="true" className="absolute inset-0 bg-cafe-0">
        <div className="absolute inset-0 scale-110 bg-[url('/assets/cafe-bg-soft.webp')] bg-cover bg-center opacity-60 blur-md" />
        <div className="absolute inset-0 bg-[radial-gradient(70%_40%_at_50%_30%,rgb(255_178_92/0.22),transparent_70%),linear-gradient(180deg,rgb(14_9_6/0.35),rgb(14_9_6/0.92)_70%)]" />
      </div>

      <div className="relative flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {call.phase === "active" ? (
          <button type="button" onClick={() => setExpanded(false)} aria-label={t("call.minimize")} className="flex size-touch items-center justify-center rounded-full text-cafe-muted active:bg-white/10">
            <ChevronDownIcon className="size-6" />
          </button>
        ) : (
          <span className="size-touch" />
        )}
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.2em] text-gold-light/80 uppercase">
          <PhoneIcon className="size-3.5" />
          {t("call.title")}
        </span>
        <span className="size-touch" />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="relative flex items-center justify-center">
          {call.phase !== "active" &&
            [0, 1, 2].map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className="animate-call-ring absolute size-36 rounded-full border-2 border-gold/60"
                style={{ animationDelay: `${i * 700}ms` }}
              />
            ))}
          <span className={`rounded-full p-1.5 ${otherSpeaking ? "animate-speak" : ""}`} style={{ background: "conic-gradient(from 200deg, #f6d68a, #8c6120, #d8a748, #f6d68a)" }}>
            <PersonAvatar id={call.otherId} size={132} />
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-gilded text-3xl font-bold">{call.otherName}</h2>
          <p className={`text-lg tabular-nums ${call.phase === "active" ? "text-online" : "text-cafe-muted"}`} aria-live="polite">
            {status}
          </p>
        </div>
        <p className="max-w-64 rounded-full bg-black/35 px-4 py-1.5 text-xs text-cafe-muted ring-1 ring-gold/20">{t("call.micHint")}</p>
      </div>

      <div className="relative flex items-end justify-center gap-10 px-6 pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+1.5rem))]">
        {incoming ? (
          <>
            <RoundAction label={t("call.decline")} tone="danger" onClick={() => void decline()}>
              <HangUpIcon className="size-8" />
            </RoundAction>
            <RoundAction label={t("call.accept")} tone="accept" onClick={() => void accept()}>
              <PhoneIcon className="animate-call-wiggle size-8" />
            </RoundAction>
          </>
        ) : (
          <>
            {call.phase === "active" && (
              <div className="flex flex-col items-center gap-2">
                <MicButton />
                <span className={`text-sm font-semibold ${micOn ? "text-online" : "text-cafe-text/90"}`}>{t(micOn ? "voice.micOn" : "voice.micOff")}</span>
              </div>
            )}
            <RoundAction label={t("call.hangUp")} tone="danger" onClick={() => void hangUp()}>
              <HangUpIcon className="size-8" />
            </RoundAction>
          </>
        )}
      </div>
    </div>
  );
}

function RoundAction({ label, tone, onClick, children }: { label: string; tone: "danger" | "accept"; onClick: () => void; children: React.ReactNode }) {
  return (
    <span className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`flex size-[4.5rem] items-center justify-center rounded-full text-white shadow-[0_10px_30px_rgb(0_0_0/0.5)] ring-4 transition-transform duration-150 active:scale-90 ${
          tone === "danger" ? "bg-[#d9472f] ring-[#d9472f]/25" : "bg-mic-on ring-mic-on/25"
        }`}
      >
        {children}
      </button>
      <span className="text-sm font-semibold text-cafe-text/90">{label}</span>
    </span>
  );
}
