"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Un message vocal enregistré, prêt à partir (ou à repartir si le réseau a coupé). */
export type VoiceNote = { blob: Blob; duration: number; peaks: number[]; fileId: string; url: string };

type Session = {
  stream: MediaStream | null;
  recorder: MediaRecorder | null;
  ctx: AudioContext | null;
  chunks: Blob[];
  levels: number[];
  startedAt: number;
  timer: number | undefined;
  send: boolean;
  released: boolean;
};

export type RecorderState = "idle" | "starting" | "recording";
export type RecorderError = "micDenied" | "unsupported" | "tooShort" | null;

export const VOICE_NOTE_MAX_SECONDS = 60;
const MIN_SECONDS = 0.7;
/** Nombre de barres de la forme d'onde envoyée avec le message. */
const BARS = 40;

/** Le format le plus léger que ce navigateur sait enregistrer (Opus de préférence). */
function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm"].find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
}

/** Ramène les niveaux mesurés pendant l'enregistrement à `BARS` barres, de 0 à 100. */
export function toPeaks(levels: number[], bars = BARS): number[] {
  if (levels.length === 0) return Array.from({ length: bars }, () => 8);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const from = Math.floor((i * levels.length) / bars);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / bars));
    let max = 0;
    for (let j = from; j < to && j < levels.length; j++) max = Math.max(max, levels[j] ?? 0);
    out.push(max);
  }
  const top = Math.max(...out, 0.0001);
  // Une voix douce reste visible : on normalise, avec un plancher.
  return out.map((v) => Math.round(8 + (92 * v) / top));
}

/**
 * Enregistrement d'un message vocal : appui long pour enregistrer (60 s au plus), Opus compressé
 * (~24 kbit/s, soit environ 180 Ko pour une minute). Mesure aussi le niveau pour dessiner
 * la forme d'onde, en direct et dans le message.
 */
export function useVoiceRecorder(onDone: (note: VoiceNote) => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<RecorderError>(null);
  const [elapsed, setElapsed] = useState(0);
  const [live, setLive] = useState<number[]>([]);
  const session = useRef<Session | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const cleanup = useCallback(() => {
    const s = session.current;
    if (!s) return;
    window.clearInterval(s.timer);
    s.stream?.getTracks().forEach((tr) => tr.stop());
    void s.ctx?.close().catch(() => undefined);
    session.current = null;
    setState("idle");
    setLive([]);
    setElapsed(0);
  }, []);

  const stop = useCallback(
    (send: boolean) => {
      const s = session.current;
      if (!s) return;
      s.send = send;
      s.released = true;
      if (s.recorder && s.recorder.state !== "inactive") s.recorder.stop();
      else if (!s.recorder) {
        // Lâché avant que le micro soit prêt : on n'enregistre rien.
        if (send) setError("tooShort");
      }
    },
    [],
  );

  const start = useCallback(async () => {
    if (session.current) return;
    setError(null);
    const mime = pickMime();
    if (!navigator.mediaDevices?.getUserMedia || mime === undefined) {
      setError("unsupported");
      return;
    }
    const s: Session = { stream: null, recorder: null, ctx: null, chunks: [], levels: [], startedAt: 0, timer: undefined, send: false, released: false };
    session.current = s;
    setState("starting");
    try {
      s.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      session.current = null;
      setState("idle");
      setError("micDenied");
      return;
    }
    if (s.released || (session.current as Session | null) !== s) {
      // Le doigt s'est levé pendant la demande d'autorisation : la prochaine fois sera la bonne.
      s.stream.getTracks().forEach((tr) => tr.stop());
      if (session.current === s) session.current = null;
      setState("idle");
      setError("tooShort");
      return;
    }

    // Niveau sonore, pour la forme d'onde.
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        s.ctx = new Ctor();
        const analyser = s.ctx.createAnalyser();
        analyser.fftSize = 512;
        s.ctx.createMediaStreamSource(s.stream).connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        const sample = () => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += v * v;
          return Math.sqrt(sum / buf.length);
        };
        s.timer = window.setInterval(() => {
          const level = sample();
          s.levels.push(level);
          setLive((prev) => [...prev.slice(-27), level]);
          const secs = (performance.now() - s.startedAt) / 1000;
          setElapsed(secs);
          if (secs >= VOICE_NOTE_MAX_SECONDS) stop(true);
        }, 90);
      }
    } catch {
      // Pas de forme d'onde : tant pis, l'enregistrement marche quand même.
    }

    const recorder = new MediaRecorder(s.stream, { mimeType: mime, audioBitsPerSecond: 24_000 });
    s.recorder = recorder;
    recorder.ondataavailable = (e) => e.data.size > 0 && s.chunks.push(e.data);
    recorder.onstop = () => {
      const duration = Math.min(VOICE_NOTE_MAX_SECONDS, (performance.now() - s.startedAt) / 1000);
      const blob = new Blob(s.chunks, { type: (recorder.mimeType || mime).split(";")[0] });
      const send = s.send;
      cleanup();
      if (!send) return;
      if (duration < MIN_SECONDS || blob.size === 0) {
        setError("tooShort");
        return;
      }
      onDoneRef.current({
        blob,
        duration: Math.round(duration * 10) / 10,
        peaks: toPeaks(s.levels),
        fileId: crypto.randomUUID(),
        url: URL.createObjectURL(blob),
      });
    };
    s.startedAt = performance.now();
    if (!s.timer) {
      s.timer = window.setInterval(() => {
        const secs = (performance.now() - s.startedAt) / 1000;
        setElapsed(secs);
        if (secs >= VOICE_NOTE_MAX_SECONDS) stop(true);
      }, 200);
    }
    recorder.start(1000);
    setState("recording");
    try {
      navigator.vibrate?.(12);
    } catch {
      // pas de vibration
    }
  }, [cleanup, stop]);

  // Quitter la page coupe le micro.
  useEffect(() => () => {
    const s = session.current;
    if (s) {
      s.send = false;
      s.recorder?.state !== "inactive" && s.recorder?.stop();
      s.stream?.getTracks().forEach((tr) => tr.stop());
    }
  }, []);

  return { state, error, elapsed, live, start, stop, clearError: () => setError(null) };
}
