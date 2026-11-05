"use client";

import { useEffect, type ReactNode } from "react";

/** Panneau qui monte du bas de l'écran (à portée de pouce). Toucher le fond ou Échap le ferme. */
export function Sheet({ children, onClose, label, wide = false }: { children: ReactNode; onClose?: () => void; label?: string; wide?: boolean }) {
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
        className={`animate-sheet cafe-panel w-full overflow-y-auto rounded-t-[1.75rem] border-b-0 text-cafe-text ${wide ? "max-h-[96dvh] max-w-3xl px-6 pt-3 pb-4" : "max-h-[85dvh] max-w-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"}`}
        // Fond plein : rien de la table ne doit transparaître derrière le panneau.
        style={{ background: "linear-gradient(180deg, #2a1d13, #120b06)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <span aria-hidden="true" className={`mx-auto -mt-2 block h-1 w-10 rounded-full bg-gold/35 ${wide ? "mb-2" : "mb-3"}`} />
        {children}
      </div>
    </div>
  );
}
