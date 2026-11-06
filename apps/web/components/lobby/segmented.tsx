"use client";

export type Choice<V> = { value: V; label: string };

/** Choix en pastilles (un seul actif), version café : fond sombre, choix actif doré. */
export function Segmented<V extends string | number>({
  label,
  value,
  choices,
  onChange,
  hint,
}: {
  label: string;
  value: V;
  choices: Choice<V>[];
  onChange: (v: V) => void;
  hint?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-ink-muted">{label}</legend>
      <div className="flex gap-1 rounded-control bg-black/35 p-1 ring-1 ring-gold/20">
        {choices.map((c) => {
          const active = c.value === value;
          return (
            <button
              key={String(c.value)}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(c.value)}
              className={`min-h-touch flex-1 rounded-[0.65rem] px-2 text-sm font-medium transition-all duration-200 ease-icos ${active ? "gold-button" : "text-ink-muted"}`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="text-xs text-cafe-muted">{hint}</p>}
    </fieldset>
  );
}
