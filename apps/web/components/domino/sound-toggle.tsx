"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { isSoundOn, onSoundChange, setSoundOn } from "@/lib/sound";

/** Bouton pour couper ou remettre les sons du jeu. */
export function SoundToggle({ tone = "app", boxed = false }: { tone?: "app" | "cafe"; boxed?: boolean }) {
  const t = useT();
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(isSoundOn());
    return onSoundChange(setOn);
  }, []);
  const look =
    tone === "cafe"
      ? `${boxed ? "cafe-panel size-12" : "size-touch"} ${on ? "text-gold-light" : "text-cafe-muted"}`
      : "size-touch text-ink-muted hover:bg-surface-2";
  return (
    <button
      type="button"
      onClick={() => setSoundOn(!on)}
      aria-pressed={on}
      aria-label={on ? t("domino.soundOn") : t("domino.soundOff")}
      className={`flex shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${look}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" fillOpacity="0.25" />
        {on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
      </svg>
    </button>
  );
}
