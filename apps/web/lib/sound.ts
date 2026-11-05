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

/** Une sortie commune, légèrement adoucie, pour que les sons ne soient jamais agressifs. */
let master: AudioNode | null = null;
function out(ac: AudioContext): AudioNode {
  if (!master) {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    const soft = ac.createBiquadFilter();
    soft.type = "lowpass";
    soft.frequency.value = 9000;
    soft.connect(comp).connect(ac.destination);
    master = soft;
  }
  return master;
}

/** Un bruit très bref (l'impact), réutilisé par tous les sons. */
let impulse: AudioBuffer | null = null;
function impact(ac: AudioContext): AudioBuffer {
  if (!impulse) {
    const n = Math.floor(ac.sampleRate * 0.006);
    impulse = ac.createBuffer(1, n, ac.sampleRate);
    const d = impulse.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  }
  return impulse;
}

/**
 * Fait « sonner » des résonances (synthèse modale) : chaque mode est un filtre très étroit
 * excité par l'impact. Une pierre en ivoire = modes aigus et brefs ; la table en bois = modes graves.
 */
function strike(ac: AudioContext, at: number, modes: [freq: number, q: number, gain: number][], level: number, detune: number) {
  const src = ac.createBufferSource();
  src.buffer = impact(ac);
  const dest = out(ac);
  for (const [f, q, g] of modes) {
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f * detune;
    bp.Q.value = q;
    const gain = ac.createGain();
    gain.gain.value = g * level;
    src.connect(bp).connect(gain).connect(dest);
  }
  // Le « clic » sec du contact, filtré vers les aigus.
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3500;
  const click = ac.createGain();
  click.gain.value = 0.35 * level;
  src.connect(hp).connect(click).connect(dest);
  src.start(at);
}

/** Modes de la pierre (ivoire/résine dure) et de la table (bois épais). */
const STONE: [number, number, number][] = [
  [2950, 28, 5.5],
  [4380, 32, 3.8],
  [6420, 36, 2.4],
];
const TABLE: [number, number, number][] = [
  [165, 9, 9],
  [390, 12, 6],
  [720, 14, 3.5],
];

/** Le claquement d'un domino posé sur la table. `strong` : on ferme la manche (plus fort, plus grave). */
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
  const t = ac.currentTime + 0.005;
  // Jamais deux fois exactement le même son : on varie un peu la hauteur.
  const detune = (strong ? 0.86 : 1) * (0.96 + Math.random() * 0.08);
  const level = strong ? 6 : 4;
  strike(ac, t, [...STONE, ...TABLE.map(([f, q, g]) => [f, q, g * (strong ? 1.6 : 1)] as [number, number, number])], level, detune);
  // La pierre rebondit à peine et se pose : un second contact, tout léger.
  strike(ac, t + 0.014 + Math.random() * 0.006, STONE, level * 0.28, detune * 1.01);
}

/** « C'est à toi » : deux notes douces, comme un petit carillon en bois. */
export function playYourTurn(): void {
  if (!isSoundOn()) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  const dest = out(ac);
  const note = (at: number, f: number, level: number) => {
    // Le son d'une lame de bois : la note, plus une harmonique aiguë qui s'éteint vite.
    for (const [mult, decay, g] of [
      [1, 0.45, 1],
      [3.9, 0.08, 0.25],
    ] as const) {
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f * mult;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(level * g, at + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      osc.connect(gain).connect(dest);
      osc.start(at);
      osc.stop(at + decay + 0.05);
    }
  };
  note(t, 784, 0.15); // sol
  note(t + 0.11, 1175, 0.12); // ré
}
