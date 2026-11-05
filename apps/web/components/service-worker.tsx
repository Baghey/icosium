"use client";

import { useEffect } from "react";

/** Enregistre le service worker pour rendre l'app installable. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}
