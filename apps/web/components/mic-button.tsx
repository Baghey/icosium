"use client";

import { useRef } from "react";
import { useT } from "@/lib/i18n";
import { useVoice } from "@/lib/voice-context";
import { MicIcon, MicOffIcon } from "./icons";

const HOLD_MS = 350;

/**
 * Gros bouton micro. Un appui = ouvert / coupé. Appui long = push-to-talk :
 * le micro s'ouvre tant qu'on garde le doigt dessus.
 */
export function MicButton({ size = "large", tone = "app" }: { size?: "large" | "small"; tone?: "app" | "cafe" }) {
  const t = useT();
  const { micOn, setMic, peers } = useVoice();
  const holdTimer = useRef<number | null>(null);
  const holding = useRef(false);
  const me = peers.find((p) => p.isLocal);
  const speaking = Boolean(me?.isSpeaking && micOn);

  const onPointerDown = () => {
    holding.current = false;
    holdTimer.current = window.setTimeout(() => {
      holding.current = true;
      if (!micOn) void setMic(true);
    }, HOLD_MS);
  };

  const onPointerUp = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    if (holding.current) {
      holding.current = false;
      void setMic(false);
    } else {
      void setMic(!micOn);
    }
  };

  const onPointerCancel = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    if (holding.current) {
      holding.current = false;
      void setMic(false);
    }
  };

  const dims = size === "large" ? "size-mic" : "size-touch";
  const iconSize = size === "large" ? "size-9" : "size-5";

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void setMic(!micOn);
        }
      }}
      aria-pressed={micOn}
      aria-label={micOn ? t("voice.micOn") : t("voice.micOff")}
      className={`${dims} relative inline-flex shrink-0 touch-none select-none items-center justify-center rounded-full transition-colors duration-200 ease-icos ${
        tone === "cafe"
          ? micOn
            ? "bg-mic-on text-white shadow-[0_0_0_3px_rgba(31,184,96,0.35),0_0_28px_rgba(31,184,96,0.55)]"
            : "cafe-panel text-cafe-text"
          : micOn
            ? "bg-mic-on text-white shadow-[0_0_0_3px_rgba(31,184,96,0.35),0_0_28px_rgba(31,184,96,0.55)]"
            : "cafe-panel text-cafe-text"
      } ${speaking ? "animate-ring" : ""}`}
    >
      {micOn ? <MicIcon className={iconSize} /> : <MicOffIcon className={iconSize} />}
    </button>
  );
}
