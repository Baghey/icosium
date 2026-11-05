"use client";

/**
 * Couche vocale d'ICOSIUM. Elle vit dans le layout racine, à côté des pages :
 * changer de page ne coupe donc jamais le vocal. Tout le monde arrive micro coupé.
 */

import {
  AudioPresets,
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteTrack,
} from "livekit-client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";

export type VoiceStatus = "idle" | "connecting" | "connected" | "reconnecting";
export type VoiceError = "full" | "micDenied" | "error" | null;

export type VoicePeer = {
  identity: string;
  name: string;
  isLocal: boolean;
  isSpeaking: boolean;
  micOn: boolean;
};

type VoiceValue = {
  status: VoiceStatus;
  roomName: string | null;
  peers: VoicePeer[];
  micOn: boolean;
  error: VoiceError;
  join: (roomName: string) => Promise<void>;
  leave: () => Promise<void>;
  setMic: (on: boolean) => Promise<void>;
};

const VoiceContext = createContext<VoiceValue | null>(null);

function toPeer(p: Participant, isLocal: boolean): VoicePeer {
  return {
    identity: p.identity,
    name: p.name || p.identity,
    isLocal,
    isSpeaking: p.isSpeaking,
    micOn: p.isMicrophoneEnabled,
  };
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { getToken, user } = useAuth();
  const roomRef = useRef<Room | null>(null);
  const audioHostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [roomName, setRoomName] = useState<string | null>(null);
  const [peers, setPeers] = useState<VoicePeer[]>([]);
  const [micOn, setMicOn] = useState(false);
  const [error, setError] = useState<VoiceError>(null);

  const refresh = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setPeers([]);
      setMicOn(false);
      return;
    }
    const list = [toPeer(room.localParticipant, true)];
    room.remoteParticipants.forEach((p) => list.push(toPeer(p, false)));
    setPeers(list);
    setMicOn(room.localParticipant.isMicrophoneEnabled);
  }, []);

  const reset = useCallback(() => {
    roomRef.current = null;
    audioHostRef.current?.replaceChildren();
    setStatus("idle");
    setRoomName(null);
    refresh();
  }, [refresh]);

  const leave = useCallback(async () => {
    const room = roomRef.current;
    reset();
    if (room) await room.disconnect();
  }, [reset]);

  const join = useCallback(
    async (name: string) => {
      if (roomRef.current) {
        if (roomRef.current.name === name) return;
        await leave();
      }
      setError(null);
      setStatus("connecting");
      try {
        const token = await getToken();
        if (!token) throw new Error("not signed in");
        const res = await fetch("/api/voice/token", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ room: name }),
        });
        if (res.status === 409) {
          setError("full");
          setStatus("idle");
          return;
        }
        if (!res.ok) throw new Error(`token ${res.status}`);
        const { token: voiceToken, url } = (await res.json()) as { token: string; url: string };

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          // Opus en mode « parole » : reste clair vers 16 à 24 kbit/s sur réseau mobile.
          publishDefaults: { audioPreset: AudioPresets.speech, dtx: true, red: true },
          audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          disconnectOnPageLeave: true,
        });
        roomRef.current = room;

        room
          .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
            // Un seul élément audio par piste, même si l'événement arrive deux fois.
            if (track.kind !== Track.Kind.Audio || track.attachedElements.length > 0) return;
            const el = track.attach();
            el.dataset.trackSid = track.sid;
            audioHostRef.current?.appendChild(el);
          })
          .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
            track.detach().forEach((el) => el.remove());
          })
          .on(RoomEvent.ParticipantConnected, refresh)
          .on(RoomEvent.ParticipantDisconnected, refresh)
          .on(RoomEvent.ActiveSpeakersChanged, refresh)
          .on(RoomEvent.TrackMuted, refresh)
          .on(RoomEvent.TrackUnmuted, refresh)
          .on(RoomEvent.TrackPublished, refresh)
          .on(RoomEvent.TrackUnpublished, refresh)
          .on(RoomEvent.LocalTrackPublished, refresh)
          .on(RoomEvent.LocalTrackUnpublished, refresh)
          .on(RoomEvent.ParticipantNameChanged, refresh)
          .on(RoomEvent.Reconnecting, () => setStatus("reconnecting"))
          .on(RoomEvent.Reconnected, () => setStatus("connected"))
          .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
            if (roomRef.current !== room) return;
            if (reason !== DisconnectReason.CLIENT_INITIATED) setError("error");
            reset();
          });

        await room.connect(url, voiceToken);
        // Débloque la lecture audio (le clic sur « rejoindre » compte comme geste de l'utilisateur).
        await room.startAudio().catch(() => undefined);
        if (room.state === ConnectionState.Connected) {
          setRoomName(name);
          setStatus("connected");
          refresh();
        }
      } catch {
        const room = roomRef.current;
        reset();
        await room?.disconnect();
        setError("error");
      }
    },
    [getToken, leave, refresh, reset],
  );

  const setMic = useCallback(
    async (on: boolean) => {
      const room = roomRef.current;
      if (!room) return;
      try {
        await room.localParticipant.setMicrophoneEnabled(on);
        setError(null);
      } catch (err) {
        const denied = err instanceof Error && (err.name === "NotAllowedError" || err.name === "SecurityError");
        setError(denied ? "micDenied" : "error");
      }
      refresh();
    },
    [refresh],
  );

  // Se déconnecter du compte = quitter le vocal.
  useEffect(() => {
    if (!user && roomRef.current) void leave();
  }, [leave, user]);

  useEffect(() => () => void roomRef.current?.disconnect(), []);

  // Le navigateur bloque le son tant qu'on n'a pas touché l'écran (ex. après un rechargement) :
  // le premier toucher débloque l'audio du salon.
  useEffect(() => {
    const unlock = () => void roomRef.current?.startAudio().catch(() => undefined);
    document.addEventListener("pointerdown", unlock);
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);

  const value = useMemo<VoiceValue>(
    () => ({ status, roomName, peers, micOn, error, join, leave, setMic }),
    [status, roomName, peers, micOn, error, join, leave, setMic],
  );

  return (
    <VoiceContext.Provider value={value}>
      {children}
      <div ref={audioHostRef} hidden aria-hidden="true" />
    </VoiceContext.Provider>
  );
}

export function useVoice(): VoiceValue {
  const value = useContext(VoiceContext);
  if (!value) throw new Error("useVoice must be used inside VoiceProvider");
  return value;
}
