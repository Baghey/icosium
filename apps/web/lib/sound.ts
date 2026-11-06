"use client";

/**
 * Sons d'ICOSIUM.
 * - Les dominos utilisent de vrais sons (public/sfx, 4 à 5 Ko chacun, volume égalisé),
 *   chargés en arrière-plan au premier son joué.
 * - Tant qu'ils ne sont pas arrivés (réseau lent, hors ligne), le navigateur fabrique
 *   un claquement de secours (synthèse Web Audio), donc il y a toujours un son.
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

/** Les vrais sons, chargés une seule fois. */
const SAMPLE_FILES = {
  clack: ["/sfx/clack1.mp3", "/sfx/clack2.mp3", "/sfx/clack3.mp3", "/sfx/clack4.mp3"],
  slam: ["/sfx/slam.mp3"],
  shuffle: ["/sfx/shuffle.mp3"],
} as const;
type SampleName = keyof typeof SAMPLE_FILES;
const samples: Partial<Record<SampleName, AudioBuffer[]>> = {};
let loading = false;

function loadSamples(ac: AudioContext): void {
  if (loading) return;
  loading = true;
  for (const [name, urls] of Object.entries(SAMPLE_FILES) as [SampleName, readonly string[]][]) {
    void Promise.all(
      urls.map(async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(url);
        return ac.decodeAudioData(await res.arrayBuffer());
      }),
    )
      .then((buffers) => {
        samples[name] = buffers;
      })
      .catch(() => {
        // On réessaiera au prochain son (coupure réseau courte).
        loading = false;
      });
  }
}

/** Joue un vrai son s'il est prêt ; renvoie false sinon (on utilisera la synthèse). */
function playSample(ac: AudioContext, name: SampleName, level: number, rate: number): boolean {
  const list = samples[name];
  if (!list?.length) return false;
  const src = ac.createBufferSource();
  src.buffer = list[Math.floor(Math.random() * list.length)] as AudioBuffer;
  src.playbackRate.value = rate;
  const gain = ac.createGain();
  gain.gain.value = level;
  src.connect(gain).connect(ac.destination);
  src.start(ac.currentTime + 0.003);
  return true;
}

/** Charge les vrais sons à l'avance (appelé dès qu'une partie s'affiche). */
export function preloadSounds(): void {
  const ac = audio();
  if (ac) loadSamples(ac);
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
  loadSamples(ac);
  // Un vrai son, avec une hauteur qui varie un tout petit peu à chaque pierre.
  const rate = 0.95 + Math.random() * 0.1;
  if (strong ? playSample(ac, "slam", 0.75, rate) : playSample(ac, "clack", 0.6, rate)) return;
  const t = ac.currentTime + 0.005;
  // Son de secours. Jamais deux fois exactement le même son : on varie un peu la hauteur.
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

/** Le mélange des pierres en début de manche (vrai son ; rien si pas encore chargé). */
export function playShuffle(): void {
  if (!isSoundOn()) return;
  const ac = audio();
  if (!ac) return;
  loadSamples(ac);
  playSample(ac, "shuffle", 0.7, 1);
}

/* ---------- Ludo : mêmes vrais sons de pierre, joués autrement ---------- */

/** Le dé qui roule sur le plateau : trois ou quatre petits chocs de plus en plus faibles. */
export function playDiceRoll(): void {
  try {
    navigator.vibrate?.([8, 60, 8, 70, 10]);
  } catch {
    // pas de vibration sur cet appareil
  }
  if (!isSoundOn()) return;
  const ac = audio();
  if (!ac) return;
  loadSamples(ac);
  const hits = [0, 0.09, 0.2, 0.34, 0.47];
  hits.forEach((at, i) => {
    const level = 0.5 * Math.pow(0.72, i);
    const rate = 1.45 + Math.random() * 0.3;
    window.setTimeout(() => {
      if (!playSample(ac, "clack", level, rate)) strike(ac, ac.currentTime + 0.003, STONE, 3 * level, 1.3);
    }, at * 1000);
  });
}

/** Un pion qui avance d'une case : un petit « tok » léger. */
export function playHop(): void {
  if (!isSoundOn()) return;
  const ac = audio();
  if (!ac) return;
  loadSamples(ac);
  if (!playSample(ac, "clack", 0.18, 1.9 + Math.random() * 0.15)) strike(ac, ac.currentTime + 0.003, STONE, 1.2, 1.5);
}

/** Un pion mangé : un claquement franc. */
export function playCapture(): void {
  try {
    navigator.vibrate?.([20, 40, 30]);
  } catch {
    // pas de vibration sur cet appareil
  }
  if (!isSoundOn()) return;
  const ac = audio();
  if (!ac) return;
  loadSamples(ac);
  if (!playSample(ac, "slam", 0.7, 1.15)) strike(ac, ac.currentTime + 0.003, [...STONE, ...TABLE], 6, 0.9);
}

/**
 * Sonnerie d'appel : trois lames de bois qui montent (sol, si, ré), comme un carillon de porte
 * de café. `soft` : la tonalité qu'entend celui qui appelle, plus discrète.
 */
export function playRing(soft = false): void {
  if (!isSoundOn()) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  const dest = out(ac);
  const level = soft ? 0.05 : 0.16;
  const notes = soft ? [587] : [784, 988, 1175];
  notes.forEach((f, i) => {
    const at = t + i * 0.16;
    for (const [mult, decay, g] of [
      [1, 0.7, 1],
      [2.76, 0.18, 0.3],
      [5.4, 0.06, 0.12],
    ] as const) {
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f * mult;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(level * g, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      osc.connect(gain).connect(dest);
      osc.start(at);
      osc.stop(at + decay + 0.05);
    }
  });
}
