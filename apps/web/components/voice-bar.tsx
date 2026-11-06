"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useCall } from "@/lib/call-context";
import { useT } from "@/lib/i18n";
import { useVoice } from "@/lib/voice-context";
import { HangUpIcon, PhoneIcon } from "./cafe-icons";
import { MicButton } from "./mic-button";
import { useCallClock } from "./social/call-screen";

/**
 * Barre vocale flottante : visible en haut de toutes les pages tant qu'on est dans un salon,
 * avec qui parle, son micro et « Leave ».
 */
export function VoiceBar() {
  const t = useT();
  const pathname = usePathname();
  const { status, peers, leave } = useVoice();
  const { call, setExpanded, hangUp } = useCall();
  const ref = useRef<HTMLDivElement>(null);
  const inCall = call?.phase === "active";
  const visible = (status !== "idle" && status !== "connecting") || inCall;
  const clock = useCallClock(inCall ? call.answeredAt : null);

  // Les écrans plein écran (la table de jeu) retirent la hauteur de la barre via --voicebar.
  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!visible || !el) {
      root.style.setProperty("--voicebar", "0px");
      return;
    }
    const obs = new ResizeObserver(() => root.style.setProperty("--voicebar", `${el.offsetHeight}px`));
    obs.observe(el);
    return () => {
      obs.disconnect();
      root.style.setProperty("--voicebar", "0px");
    };
  }, [visible]);

  if (!visible) return null;

  // Appel privé en cours : on le rappelle en haut de chaque page.
  if (inCall) {
    return (
      <div ref={ref} role="region" aria-label={t("call.with", { name: call.otherName })} className="sticky top-0 z-40 border-b border-mic-on/40 bg-[linear-gradient(90deg,#0f3a24,#16261a)]/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-mic-on text-white">
            <PhoneIcon className="size-4" />
          </span>
          <button type="button" onClick={() => setExpanded(true)} className="flex min-h-touch min-w-0 flex-1 flex-col items-start justify-center text-start">
            <span className="w-full truncate text-sm font-semibold">{t("call.with", { name: call.otherName })}</span>
            <span className="text-xs text-online tabular-nums">{status === "reconnecting" ? t("voice.reconnecting") : clock}</span>
          </button>
          <MicButton size="small" />
          <button
            type="button"
            onClick={() => void hangUp()}
            aria-label={t("call.hangUp")}
            className="flex size-touch items-center justify-center rounded-full bg-[#d9472f] text-white transition-transform duration-150 active:scale-90"
          >
            <HangUpIcon className="size-5" />
          </button>
        </div>
      </div>
    );
  }

  const speakers = peers.filter((p) => p.isSpeaking && p.micOn);
  const label =
    status === "reconnecting"
      ? t("voice.reconnecting")
      : speakers.length > 0
        ? t("voice.isSpeaking", { name: speakers.map((p) => (p.isLocal ? t("voice.you") : p.name)).join(", ") })
        : t("voice.nobodySpeaking");

  return (
    <div
      ref={ref}
      role="region"
      aria-label={t("voice.inRoom")}
      className="sticky top-0 z-40 border-b border-gold/25 bg-cafe-1/95 pt-[env(safe-area-inset-top)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-2">
        <span
          className={`size-2.5 shrink-0 rounded-full ${status === "reconnecting" ? "bg-ink-muted" : "bg-mic-on"} ${
            speakers.length > 0 ? "animate-pulse" : ""
          }`}
          aria-hidden="true"
        />
        {pathname === "/voice" ? (
          <p className="min-w-0 flex-1 truncate text-sm" aria-live="polite">
            {label}
          </p>
        ) : (
          <Link href="/voice" className="min-w-0 flex-1 truncate py-2 text-sm" aria-live="polite">
            {label}
          </Link>
        )}
        <MicButton size="small" />
        <button
          type="button"
          onClick={() => void leave()}
          className="min-h-touch rounded-control px-3 text-sm font-medium text-danger transition-colors duration-200 hover:bg-white/5"
        >
          {t("voice.leave")}
        </button>
      </div>
    </div>
  );
}
