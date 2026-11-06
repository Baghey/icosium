"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { PauseIcon, PlayIcon } from "@/components/cafe-icons";
import { useT } from "@/lib/i18n";
import { voiceNoteUrl, type VoiceMeta } from "@/lib/social-context";

/** Un seul message vocal joue à la fois, dans toute l'app. */
let current: HTMLAudioElement | null = null;

const SPEEDS = [1, 1.5, 2] as const;

export const formatSeconds = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Lecteur de message vocal : bouton lecture, forme d'onde qui se remplit pendant l'écoute
 * (toucher la forme pour avancer), durée et vitesse (1×, 1,5×, 2×).
 */
export function VoiceNotePlayer({ meta, localUrl, mine }: { meta: VoiceMeta; localUrl?: string; mine: boolean }) {
  const t = useT();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const frame = useRef<number | undefined>(undefined);
  const duration = Math.max(0.5, meta.duration);
  const peaks = meta.peaks.length > 0 ? meta.peaks : Array.from({ length: 40 }, (_, i) => 20 + ((i * 37) % 50));

  useEffect(
    () => () => {
      window.cancelAnimationFrame(frame.current ?? 0);
      const a = audioRef.current;
      if (a) {
        a.pause();
        if (current === a) current = null;
      }
    },
    [],
  );

  const tick = () => {
    const a = audioRef.current;
    if (!a) return;
    setProgress(Math.min(1, a.currentTime / duration));
    if (!a.paused) frame.current = window.requestAnimationFrame(tick);
  };

  async function audio(): Promise<HTMLAudioElement | null> {
    if (audioRef.current) return audioRef.current;
    setLoading(true);
    const src = localUrl ?? (await voiceNoteUrl(meta.path));
    setLoading(false);
    if (!src) {
      setFailed(true);
      return null;
    }
    const a = new Audio(src);
    a.preload = "auto";
    a.onended = () => {
      setPlaying(false);
      setProgress(0);
    };
    a.onpause = () => setPlaying(false);
    a.onplay = () => {
      setPlaying(true);
      frame.current = window.requestAnimationFrame(tick);
    };
    a.onerror = () => {
      setFailed(true);
      setPlaying(false);
    };
    audioRef.current = a;
    return a;
  }

  async function toggle() {
    setFailed(false);
    const a = await audio();
    if (!a) return;
    if (!a.paused) {
      a.pause();
      return;
    }
    if (current && current !== a) current.pause();
    current = a;
    a.playbackRate = speed;
    await a.play().catch(() => setFailed(true));
  }

  async function seek(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const x = rtl ? rect.right - e.clientX : e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const a = await audio();
    if (!a) return;
    a.currentTime = ratio * duration;
    setProgress(ratio);
    if (a.paused) void toggle();
  }

  function nextSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  const shown = playing || progress > 0 ? duration * (1 - progress) : duration;
  const ink = mine ? "bg-[#2a1a08]" : "bg-gold-light";
  return (
    <div className="flex w-60 max-w-[70vw] items-center gap-2.5 py-0.5">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={playing ? t("social.voice.pause") : t("social.voice.play")}
        className={`flex size-touch shrink-0 items-center justify-center rounded-full transition-transform duration-150 active:scale-90 ${
          mine ? "bg-[#2a1a08] text-gold-light" : "gold-button"
        } ${loading ? "animate-pulse" : ""}`}
      >
        {playing ? <PauseIcon className="size-5" /> : <PlayIcon className="size-5 rtl:-scale-x-100" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          role="slider"
          tabIndex={0}
          aria-label={t("social.voice.position")}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(progress * duration)}
          onPointerDown={(e) => void seek(e)}
          onKeyDown={(e) => {
            const a = audioRef.current;
            if (!a) return;
            if (e.key === "ArrowRight") a.currentTime = Math.min(duration, a.currentTime + 2);
            if (e.key === "ArrowLeft") a.currentTime = Math.max(0, a.currentTime - 2);
            setProgress(a.currentTime / duration);
          }}
          className="flex h-8 cursor-pointer items-center gap-[2px]"
        >
          {peaks.map((p, i) => {
            const done = (i + 0.5) / peaks.length <= progress;
            return (
              <span
                key={i}
                aria-hidden="true"
                className={`w-[3px] flex-1 rounded-full transition-opacity duration-150 ${ink} ${done ? "opacity-100" : "opacity-35"}`}
                style={{ height: `${Math.max(12, p)}%` }}
              />
            );
          })}
        </div>
        <span className={`flex items-center justify-between text-[11px] font-semibold tabular-nums ${mine ? "text-[#2a1a08]/75" : "text-cafe-muted"}`}>
          <span>{failed ? t("social.voice.failed") : formatSeconds(shown)}</span>
          <button type="button" onClick={nextSpeed} className={`-my-3 min-h-touch min-w-touch rounded-full px-2 ${mine ? "active:bg-black/10" : "active:bg-white/10"}`} aria-label={t("social.voice.speed")}>
            {speed}×
          </button>
        </span>
      </div>
    </div>
  );
}
