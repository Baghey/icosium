"use client";

import { useEffect, type ReactNode } from "react";

/** Panneau qui monte du bas de l'écran (à portée de pouce). Toucher le fond ou Échap le ferme. */
export function Sheet({ children, onClose, label }: { children: ReactNode; onClose?: () => void; label?: string }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 animate-fade" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="animate-sheet cafe-panel max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-[1.75rem] border-b-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-cafe-text"
        // Fond plein : rien de la table ne doit transparaître derrière le panneau.
        style={{ background: "linear-gradient(180deg, #2a1d13, #120b06)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <span aria-hidden="true" className="mx-auto -mt-2 mb-3 block h-1 w-10 rounded-full bg-gold/35" />
        {children}
      </div>
    </div>
  );
}
