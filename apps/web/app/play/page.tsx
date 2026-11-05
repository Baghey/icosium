"use client";

import { DEFAULT_DOMINO_OPTIONS, type DominoOptions } from "@icosium/shared";
import type { MessageKey } from "@icosium/i18n";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DominoTile } from "@/components/domino/tile";
import { callDomino } from "@/lib/domino-client";
import { useT } from "@/lib/i18n";

export default function PlayPage() {
  return (
    <AppShell>
      <Play />
    </AppShell>
  );
}

const ERRORS: Record<string, MessageKey> = {
  invalid_code: "play.error.invalid_code",
  table_not_found: "play.error.table_not_found",
  table_full: "play.error.table_full",
  table_started: "play.error.table_started",
  seat_taken: "play.error.seat_taken",
  rate_limited: "play.error.rate_limited",
};
const errorKey = (e: string): MessageKey => ERRORS[e] ?? "play.error.unknown";

type Choice<V> = { value: V; label: string };

function Segmented<V extends string | number>({ label, value, choices, onChange }: { label: string; value: V; choices: Choice<V>[]; onChange: (v: V) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-ink-muted">{label}</legend>
      <div className="flex gap-1 rounded-control bg-surface-2 p-1">
        {choices.map((c) => {
          const active = c.value === value;
          return (
            <button
              key={String(c.value)}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(c.value)}
              className={`min-h-touch flex-1 rounded-[0.65rem] px-2 text-sm font-medium transition-all duration-200 ease-icos ${
                active ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-ink-muted"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Play() {
  const t = useT();
  const router = useRouter();
  const [options, setOptions] = useState<DominoOptions>(DEFAULT_DOMINO_OPTIONS);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<{ where: "create" | "join"; key: MessageKey } | null>(null);
  const set = <K extends keyof DominoOptions>(k: K, v: DominoOptions[K]) => setOptions((o) => ({ ...o, [k]: v }));

  async function create() {
    setBusy("create");
    setError(null);
    const res = await callDomino({ op: "create", options });
    if (res.ok) router.push(`/play/${res.data.code as string}`);
    else {
      setBusy(null);
      setError({ where: "create", key: errorKey(res.error) });
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(clean)) {
      setError({ where: "join", key: "play.error.invalid_code" });
      return;
    }
    setBusy("join");
    setError(null);
    const res = await callDomino({ op: "join", code: clean });
    if (res.ok) router.push(`/play/${clean}`);
    else {
      setBusy(null);
      setError({ where: "join", key: errorKey(res.error) });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <div className="flex -rotate-12 gap-1 drop-shadow-md" dir="ltr" aria-hidden="true">
          <DominoTile a={6} b={6} orientation="vertical" size={22} />
          <DominoTile a={6} b={3} orientation="vertical" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{t("play.title")}</h1>
          <p className="text-ink-muted">{t("play.subtitle")}</p>
        </div>
      </header>

      <form onSubmit={join} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
        <div>
          <h2 className="font-semibold">{t("play.join")}</h2>
          <p className="text-sm text-ink-muted">{t("play.joinHint")}</p>
        </div>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="code">
            {t("play.code")}
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase())}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABCD"
            dir="ltr"
            className="min-h-14 w-0 flex-1 rounded-control border border-line bg-bg px-4 text-center text-2xl font-semibold tracking-[0.4em] uppercase placeholder:text-ink-muted/40 focus:border-mint focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy !== null}
            className="min-h-14 rounded-control bg-ink px-5 font-semibold text-bg transition-transform duration-150 active:scale-[0.97] disabled:opacity-60"
          >
            {busy === "join" ? t("play.joining") : t("play.joinButton")}
          </button>
        </div>
        {error?.where === "join" && (
          <p role="alert" className="text-sm text-danger">
            {t(error.key)}
          </p>
        )}
      </form>

      <section className="flex flex-col gap-5 rounded-card border border-line bg-surface p-4">
        <div>
          <h2 className="font-semibold">{t("play.create")}</h2>
          <p className="text-sm text-ink-muted">{t("play.createHint")}</p>
        </div>
        <Segmented
          label={t("play.players")}
          value={options.players}
          onChange={(v) => set("players", v)}
          choices={[
            { value: 4, label: t("play.players4") },
            { value: 2, label: t("play.players2") },
          ]}
        />
        <Segmented
          label={t("play.target")}
          value={options.targetScore}
          onChange={(v) => set("targetScore", v)}
          choices={[51, 101, 151].map((n) => ({ value: n as DominoOptions["targetScore"], label: String(n) }))}
        />
        <Segmented
          label={t("play.turnTime")}
          value={options.turnSeconds}
          onChange={(v) => set("turnSeconds", v)}
          choices={[
            { value: 15, label: t("play.seconds", { n: 15 }) },
            { value: 30, label: t("play.seconds", { n: 30 }) },
            { value: 0, label: t("play.unlimited") },
          ]}
        />
        <Segmented
          label={t("play.opener")}
          value={options.opener}
          onChange={(v) => set("opener", v)}
          choices={[
            { value: "winner", label: t("play.openerWinner") },
            { value: "doubleSix", label: t("play.openerDoubleSix") },
          ]}
        />
        <Segmented
          label={t("play.scoring")}
          value={options.scoring}
          onChange={(v) => set("scoring", v)}
          choices={[
            { value: "opponents", label: t("play.scoringOpponents") },
            { value: "all", label: t("play.scoringAll") },
          ]}
        />
        {error?.where === "create" && (
          <p role="alert" className="text-sm text-danger">
            {t(error.key)}
          </p>
        )}
        <button
          type="button"
          onClick={() => void create()}
          disabled={busy !== null}
          className="flex min-h-14 items-center justify-center rounded-card bg-mint px-6 text-lg font-semibold text-mint-ink transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
        >
          {busy === "create" ? t("play.creating") : t("play.create")}
        </button>
      </section>
    </div>
  );
}
