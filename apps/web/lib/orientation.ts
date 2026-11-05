"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Le domino se joue en paysage sur téléphone : plus de place pour la table.
 * - Android (Chrome, PWA installée) : on passe en plein écran et on verrouille l'écran en paysage,
 *   dès l'arrivée à la table (ou au premier toucher, le navigateur exigeant un geste).
 * - iPhone : le verrouillage n'existe pas ; on affiche un petit conseil « Tourne ton téléphone ».
 * Le joueur peut revenir en portrait avec le bouton dédié ; son choix est retenu.
 */

const KEY = "icosium.landscape";

type LockableOrientation = ScreenOrientation & { lock?: (o: "landscape" | "portrait") => Promise<void>; unlock?: () => void };

function readPref(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

function writePref(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // stockage indisponible
  }
}

const isPhone = () => window.matchMedia("(pointer: coarse)").matches && Math.min(window.screen.width, window.screen.height) < 600;
const standalone = () => window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches;

async function lockLandscape(): Promise<boolean> {
  const o = screen.orientation as LockableOrientation | undefined;
  if (!o?.lock) return false;
  try {
    if (!standalone() && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    }
    await o.lock("landscape");
    return true;
  } catch {
    return false;
  }
}

function unlock() {
  try {
    (screen.orientation as LockableOrientation | undefined)?.unlock?.();
  } catch {
    // rien à déverrouiller
  }
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
}

/** Vrai quand l'écran est un téléphone tenu en paysage (mise en page dédiée). */
export function useLandscapeLayout(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape) and (max-height: 560px)");
    setOn(mq.matches);
    const change = () => setOn(mq.matches);
    mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, []);
  return on;
}

export function useGameOrientation() {
  const [prefer, setPrefer] = useState(true);
  const [phone, setPhone] = useState(false);
  const landscape = useLandscapeLayout();

  useEffect(() => {
    const p = isPhone();
    setPhone(p);
    const want = readPref();
    setPrefer(want);
    if (!p || !want) return;
    // Essai immédiat (marche dans l'app installée), sinon au premier toucher.
    let done = false;
    void lockLandscape().then((ok) => {
      done = ok;
    });
    const onTouch = () => {
      if (!done && readPref()) void lockLandscape().then((ok) => (done = ok));
    };
    window.addEventListener("pointerdown", onTouch, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onTouch);
      unlock();
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !landscape;
    writePref(next);
    setPrefer(next);
    if (next) void lockLandscape();
    else {
      const o = screen.orientation as LockableOrientation | undefined;
      void (o?.lock?.("portrait") ?? Promise.reject(new Error("no lock"))).catch(unlock);
    }
  }, [landscape]);

  return { landscape, phone, prefer, toggle, showHint: phone && prefer && !landscape };
}
