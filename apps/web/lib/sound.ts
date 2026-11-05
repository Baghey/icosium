"use client";

/**
 * Sons d'ICOSIUM, fabriqués par le navigateur (Web Audio) : aucun fichier à télécharger.
 * Le claquement imite un domino posé sec sur une table en bois.
 */

const STORAGE_KEY = "icosium.sound";
let ctx: AudioContext | null = null;
let enabled: boolean | null = null;
const listeners = new Set<(on: boolean) => void>();

export function isSoundOn(): boolean {
  if (enabled === null) {
    try {
      enabled = window.localStorage.getItem(STORAGE_KEY) !== "off";
    } catch {
      enabled = true;
    }
  }
  return enabled;
}

export function setSoundOn(on: boolean): void {
  enabled = on;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // stockage indisponible
  }
  listeners.forEach((l) => l(on));
}

export function onSoundChange(listener: (on: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Le claquement d'un domino. `strong` : plus fort et plus grave, quand on ferme la manche. */
export function playClack(strong = false): void {
  // Petite vibration du téléphone, comme le choc de la pierre sur la table.
  try {
    navigator.vibrate?.(strong ? [18, 40, 28] : 14);
  } catch {
    // pas de vibration sur cet appareil
  }
  if (!isSoundOn()) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const volume = strong ? 0.9 : 0.5;

  // Le « clac » : un bruit très court, filtré vers les aigus.
  const length = Math.floor(ac.sampleRate * 0.05);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 6);
  const noise = ac.createBufferSource();
  noise.buffer = buffer;
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = strong ? 1800 : 2600;
  band.Q.value = 1.2;
  const noiseGain = ac.createGain();
  noiseGain.gain.value = volume;
  noise.connect(band).connect(noiseGain).connect(ac.destination);
  noise.start(t);

  // Le « toc » de la table en bois.
  const body = ac.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(strong ? 140 : 220, t);
  body.frequency.exponentialRampToValueAtTime(strong ? 60 : 110, t + 0.08);
  const bodyGain = ac.createGain();
  bodyGain.gain.setValueAtTime(volume * (strong ? 0.9 : 0.4), t);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, t + (strong ? 0.18 : 0.09));
  body.connect(bodyGain).connect(ac.destination);
  body.start(t);
  body.stop(t + 0.2);
}

/** Petit signal doux : c'est ton tour. */
export function playYourTurn(): void {
  if (!isSoundOn()) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(660, t);
  osc.frequency.setValueAtTime(880, t + 0.08);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.3);
}
