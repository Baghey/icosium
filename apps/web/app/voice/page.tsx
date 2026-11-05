"use client";

import { TEST_VOICE_ROOM, VOICE_ROOM_MAX_PARTICIPANTS } from "@icosium/shared";
import { AppShell } from "@/components/app-shell";
import { MicIcon, MicOffIcon, SeatIcon } from "@/components/icons";
import { MicButton } from "@/components/mic-button";
import { useT } from "@/lib/i18n";
import { useVoice, type VoicePeer } from "@/lib/voice-context";

export default function VoicePage() {
  return (
    <AppShell>
      <VoiceRoom />
    </AppShell>
  );
}

function VoiceRoom() {
  const t = useT();
  const { status, peers, error, join } = useVoice();
  const inRoom = status === "connected" || status === "reconnecting";
  const seats: (VoicePeer | null)[] = Array.from({ length: VOICE_ROOM_MAX_PARTICIPANTS }, (_, i) => peers[i] ?? null);

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-gilded text-3xl font-bold">{t("voice.title")}</h1>
        <p className="text-ink-muted">{t("voice.intro")}</p>
      </header>

      <ul className="grid grid-cols-2 gap-3">
        {seats.map((peer, i) => (
          <li key={peer?.identity ?? `empty-${i}`}>
            <Seat peer={inRoom ? peer : null} />
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="rounded-control bg-black/40 p-3 text-sm text-danger ring-1 ring-danger/40">
          {t(error === "full" ? "voice.full" : error === "micDenied" ? "voice.micDenied" : "voice.error")}
        </p>
      )}

      <div className="mt-auto flex flex-col items-center gap-3">
        {inRoom ? (
          <>
            <MicButton />
            <p className="text-center text-sm text-ink-muted">{t("voice.micHint")}</p>
          </>
        ) : (
          <button
            type="button"
            disabled={status === "connecting"}
            onClick={() => void join(TEST_VOICE_ROOM)}
            className="flex min-h-14 w-full items-center justify-center rounded-card gold-button px-6 text-lg font-bold transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
          >
            {status === "connecting" ? t("voice.joining") : t("voice.join")}
          </button>
        )}
      </div>
    </div>
  );
}

function Seat({ peer }: { peer: VoicePeer | null }) {
  const t = useT();
  if (!peer) {
    return (
      <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-card border border-dashed border-gold/35 bg-black/25 text-ink-muted">
        <SeatIcon className="size-8" />
        <span className="text-sm">{t("voice.emptySeat")}</span>
      </div>
    );
  }
  const speaking = peer.isSpeaking && peer.micOn;
  const initial = peer.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className={`flex aspect-square flex-col items-center justify-center gap-2 cafe-card transition-colors duration-200 ${
        speaking ? "!border-mic-on" : ""
      }`}
    >
      <div
        className={`flex size-16 items-center justify-center rounded-full border-2 border-gold/60 bg-cafe-2 text-2xl font-semibold text-gold-light ${
          speaking ? "animate-ring" : ""
        }`}
        aria-hidden="true"
      >
        {initial}
      </div>
      <span className="max-w-full truncate px-2 text-sm font-medium">
        {peer.isLocal ? `${peer.name} (${t("voice.you")})` : peer.name}
      </span>
      <span className="flex items-center gap-1 text-xs text-ink-muted">
        {peer.micOn ? <MicIcon className="size-4 text-mint" /> : <MicOffIcon className="size-4" />}
        {speaking ? t("voice.speaking") : peer.micOn ? t("voice.micOn") : t("voice.micOff")}
      </span>
    </div>
  );
}
