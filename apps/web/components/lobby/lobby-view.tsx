"use client";

import { DEFAULT_DOMINO_OPTIONS, DEFAULT_LUDO_OPTIONS, type DominoOptions, type LudoOptions } from "@icosium/shared";
import type { MessageKey } from "@icosium/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { BotIcon, CloseIcon } from "@/components/cafe-icons";
import { DominoTile } from "@/components/domino/tile";
import { DieFace } from "@/components/ludo/die";
import { MiniTable } from "./mini-table";
import { Segmented } from "./segmented";
import { TableCard } from "./table-card";
import { visibilityHint, visibilityLabel } from "./table-tools";
import { Sheet } from "@/components/sheet";
import { GAMES, GAME_IDS, type GameId, isGameId, tablePath } from "@/lib/games";
import { useT } from "@/lib/i18n";
import { type LobbyTable, type Visibility, VISIBILITIES, setTableVisibility } from "@/lib/lobby";
import { preloadSounds } from "@/lib/sound";

const ERRORS: Record<string, MessageKey> = {
  invalid_code: "play.error.invalid_code",
  table_not_found: "play.error.table_not_found",
  table_full: "play.error.table_full",
  table_started: "play.error.table_started",
  seat_taken: "play.error.seat_taken",
  rate_limited: "play.error.rate_limited",
  kicked: "play.error.kicked",
};
const errorKey = (e: string): MessageKey => ERRORS[e] ?? "play.error.unknown";

type Filter = GameId | "all";

/**
 * Le lobby : ouvrir une table, retrouver les siennes, et s'asseoir à celles des amis.
 * Les données arrivent de l'extérieur (la page les lit en direct ; /dev/lobby donne des exemples).
 */
export function LobbyView({ tables, failed, meId, friendIds }: { tables: LobbyTable[] | null; failed: boolean; meId: string | null; friendIds: Set<string> }) {
  const t = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const [sheet, setSheet] = useState<null | { mode: "create" | "solo"; game: GameId } | { mode: "code" }>(null);

  // /play?game=ludo choisit le jeu ; /play#join ouvre directement « J'ai un code ».
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("game");
    if (isGameId(g)) setFilter(g);
    if (window.location.hash === "#join") setSheet({ mode: "code" });
  }, []);
  function pickFilter(f: Filter) {
    setFilter(f);
    window.history.replaceState(null, "", f === "all" ? "/play" : `/play?game=${f}`);
  }

  const mine = (tables ?? []).filter((x) => x.mine);
  // Tables ouvertes : celles où un ami est assis d'abord, puis les plus récentes.
  const open = (tables ?? [])
    .filter((x) => !x.mine && (filter === "all" || x.game === filter))
    .sort((a, b) => Number(b.seats.some((s) => s.userId && friendIds.has(s.userId))) - Number(a.seats.some((s) => s.userId && friendIds.has(s.userId))));
  const startGame: GameId = filter === "all" ? "domino" : filter;

  return (
    <div className="flex flex-col gap-6">
      <header className="animate-rise flex flex-col gap-1">
        <h1 className="text-gilded text-3xl leading-tight font-bold">{t("lobby.title")}</h1>
        <p className="text-sm text-ink-muted">{t("lobby.subtitle")}</p>
      </header>

      {/* Ouvrir une table : l'action principale, en grand, sous le pouce. */}
      <button
        type="button"
        onClick={() => setSheet({ mode: "create", game: startGame })}
        className="animate-rise group relative block overflow-hidden rounded-[1.6rem] border border-gold/50 text-start shadow-[0_18px_40px_rgb(0_0_0/0.55)] transition-transform duration-200 active:scale-[0.98]"
        style={{ animationDelay: "50ms" }}
      >
        <span className="felt-table felt-grain relative flex min-h-40 flex-col justify-end !rounded-[1.6rem] p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/rosette.webp" alt="" aria-hidden="true" className="pointer-events-none absolute end-[-2rem] top-[-2rem] size-44 opacity-25" />
          <span className="absolute end-4 top-3 flex items-end gap-1.5 transition-transform duration-250 ease-icos group-active:rotate-2" aria-hidden="true">
            <span className="rotate-[-16deg] drop-shadow-[0_6px_8px_rgb(0_0_0/0.5)]" dir="ltr">
              <DominoTile a={6} b={6} orientation="vertical" size={17} />
            </span>
            <span className="mb-1 rotate-[12deg] drop-shadow-[0_6px_8px_rgb(0_0_0/0.5)]">
              <DieFace value={6} size={28} />
            </span>
          </span>
          <span className="relative flex flex-col gap-0.5 pe-14">
            <span className="text-gilded text-2xl font-bold drop-shadow">{t("lobby.open")}</span>
            <span className="text-sm text-cafe-text/85">{t("lobby.openHint")}</span>
          </span>
          <span className="gold-button relative mt-3 flex min-h-touch w-fit items-center rounded-full px-6 font-bold">{t("lobby.newTable")}</span>
        </span>
      </button>

      <div className="animate-rise grid grid-cols-2 gap-3" style={{ animationDelay: "100ms" }}>
        <button
          type="button"
          onClick={() => setSheet({ mode: "solo", game: startGame })}
          className="cafe-card flex min-h-20 flex-col items-start justify-center gap-1 px-4 py-3 text-start font-semibold transition-transform duration-150 active:scale-[0.97]"
        >
          <BotIcon className="size-6 text-gold-light" />
          <span className="text-sm leading-tight">{t("lobby.soloShort")}</span>
        </button>
        <button
          type="button"
          onClick={() => setSheet({ mode: "code" })}
          className="cafe-card flex min-h-20 flex-col items-start justify-center gap-1 px-4 py-3 text-start font-semibold transition-transform duration-150 active:scale-[0.97]"
        >
          <span className="font-mono text-base leading-6 font-bold tracking-[0.2em] text-gold-light" dir="ltr">
            ABCD
          </span>
          <span className="text-sm leading-tight">{t("lobby.haveCode")}</span>
        </button>
      </div>

      {mine.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="section-title">{t("lobby.mine")}</h2>
          {mine.map((x, i) => (
            <TableCard key={`${x.game}-${x.id}`} table={x} friendIds={friendIds} meId={meId} index={i} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="section-title">{t("lobby.openTables")}</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label={t("play.game")}>
          {(["all", ...GAME_IDS] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => pickFilter(f)}
              className={`min-h-touch shrink-0 rounded-full px-5 text-sm font-semibold transition-all duration-200 ${filter === f ? "gold-button" : "cafe-panel text-cafe-muted"}`}
            >
              {f === "all" ? t("lobby.filterAll") : t(GAMES[f].name)}
            </button>
          ))}
        </div>
        {failed && tables && <p className="text-xs text-cafe-muted">{t("lobby.slow")}</p>}
        {tables === null ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="cafe-card h-[5.6rem] animate-pulse opacity-60" />
            ))}
          </div>
        ) : open.length === 0 ? (
          <div className="cafe-card flex flex-col items-center gap-3 px-5 py-6 text-center">
            <MiniTable game={filter === "ludo" ? "ludo" : "domino"} players={4} seats={[]} size={76} />
            <p className="font-semibold">{t("lobby.empty")}</p>
            <p className="text-sm text-cafe-muted">{t("lobby.emptyHint")}</p>
            <button
              type="button"
              onClick={() => setSheet({ mode: "create", game: startGame })}
              className="gold-button mt-1 flex min-h-touch items-center rounded-full px-6 text-sm font-bold transition-transform duration-150 active:scale-[0.97]"
            >
              {t("lobby.open")}
            </button>
          </div>
        ) : (
          open.map((x, i) => <TableCard key={`${x.game}-${x.id}`} table={x} friendIds={friendIds} meId={meId} index={i} />)
        )}
      </section>

      {sheet?.mode === "code" && <JoinByCode onClose={() => setSheet(null)} />}
      {sheet && sheet.mode !== "code" && <NewTable solo={sheet.mode === "solo"} initialGame={sheet.game} onClose={() => setSheet(null)} />}
    </div>
  );
}

/** Le grand choix du jeu : une carte par jeu, avec son dessin. */
function GamePicker({ value, onChange }: { value: GameId; onChange: (g: GameId) => void }) {
  const t = useT();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-ink-muted">{t("lobby.chooseGame")}</legend>
      <div className="grid grid-cols-2 gap-2">
        {GAME_IDS.map((g) => {
          const active = g === value;
          return (
            <button
              key={g}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(g)}
              className={`flex min-h-28 flex-col items-start gap-2 rounded-card border p-3 text-start transition-all duration-200 ${
                active ? "border-gold bg-gold/10 shadow-[0_0_18px_rgb(216_167_72/0.28)]" : "border-gold/20 bg-black/30"
              }`}
            >
              <span className="flex h-10 items-center gap-1" aria-hidden="true">
                {g === "domino" ? (
                  <span className="flex -rotate-12 gap-1" dir="ltr">
                    <DominoTile a={6} b={6} orientation="vertical" size={16} />
                    <DominoTile a={5} b={3} orientation="vertical" size={16} />
                  </span>
                ) : (
                  <span className="flex -rotate-12 gap-1">
                    <DieFace value={6} size={28} />
                    <DieFace value={3} size={28} />
                  </span>
                )}
              </span>
              <span className={`font-bold ${active ? "text-gilded" : ""}`}>{t(GAMES[g].name)}</span>
              <span className="text-xs leading-snug text-cafe-muted">{t(GAMES[g].tagline)}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const LEARNED_KEY = "icosium.ludo.learn";

/** Nouvelle table (ou partie seul contre des bots) : le jeu, ses règles, et qui la voit. */
function NewTable({ solo, initialGame, onClose }: { solo: boolean; initialGame: GameId; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const [game, setGame] = useState<GameId>(initialGame);
  const [domino, setDomino] = useState<DominoOptions>(DEFAULT_DOMINO_OPTIONS);
  const [ludo, setLudo] = useState<LudoOptions>(DEFAULT_LUDO_OPTIONS);
  const [visibility, setVisibility] = useState<Visibility>("friends");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [newToLudo, setNewToLudo] = useState(false);
  useEffect(() => {
    try {
      setNewToLudo(window.localStorage.getItem(LEARNED_KEY) !== "done");
    } catch {
      setNewToLudo(false);
    }
  }, []);
  const setD = <K extends keyof DominoOptions>(k: K, v: DominoOptions[K]) => setDomino((o) => ({ ...o, [k]: v }));
  const setL = <K extends keyof LudoOptions>(k: K, v: LudoOptions[K]) => setLudo((o) => ({ ...o, [k]: v }));

  async function create() {
    // Ce toucher autorise le son : on charge déjà le mélange et les claquements.
    preloadSounds();
    setBusy(true);
    setError(null);
    const res = await GAMES[game].call({ op: "create", options: game === "ludo" ? ludo : domino, solo, visibility });
    if (res.ok) {
      // La visibilité est aussi réglée ici : ça marche même si le serveur du jeu ne la lit pas encore.
      if (!solo && visibility !== "friends" && typeof res.data.tableId === "string") await setTableVisibility(game, res.data.tableId, visibility);
      router.push(tablePath(game, res.data.code as string));
    }
    else {
      setBusy(false);
      setError(errorKey(res.error));
    }
  }

  const time = (value: number, onChange: (v: 0 | 15 | 30) => void) => (
    <Segmented
      label={t("play.turnTime")}
      value={value}
      onChange={(v) => onChange(v as 0 | 15 | 30)}
      choices={[
        { value: 15, label: t("play.seconds", { n: 15 }) },
        { value: 30, label: t("play.seconds", { n: 30 }) },
        { value: 0, label: t("play.unlimited") },
      ]}
    />
  );

  return (
    <Sheet onClose={onClose} label={solo ? t("lobby.soloShort") : t("lobby.newTable")}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-gilded text-xl font-bold">{solo ? t("play.solo") : t("lobby.newTable")}</h2>
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex size-touch items-center justify-center rounded-full text-cafe-muted">
          <CloseIcon className="size-5" />
        </button>
      </div>
      <div className="flex flex-col gap-5">
        <GamePicker value={game} onChange={setGame} />

        {game === "ludo" && (
          <Link
            href="/ludo/learn"
            className={`flex min-h-touch items-center gap-3 rounded-control border px-3 py-2 text-sm ${newToLudo ? "border-gold/60 bg-gold/10" : "border-gold/20"}`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gold/60 font-bold text-gold-light">?</span>
            <span className="flex flex-col">
              <span className="font-semibold text-gold-light">{t("ludo.learn.button")}</span>
              {newToLudo && <span className="text-xs text-cafe-muted">{t("play.ludoFirstTime")}</span>}
            </span>
          </Link>
        )}

        <h3 className="section-title">{t("lobby.rules")}</h3>
        {game === "ludo" ? (
          <>
            <Segmented
              label={t("play.players")}
              value={ludo.players === 4 && ludo.teams ? 5 : ludo.players}
              onChange={(v) => setLudo((o) => ({ ...o, players: v === 5 ? 4 : (v as 2 | 3 | 4), teams: v === 5 }))}
              choices={[
                { value: 2, label: t("play.players2") },
                { value: 3, label: t("play.players3") },
                { value: 4, label: t("play.ludoPlayers4") },
                { value: 5, label: t("play.ludoTeams") },
              ]}
            />
            <Segmented
              label={t("play.pawnsToWin")}
              value={ludo.pawnsToWin}
              onChange={(v) => setL("pawnsToWin", v)}
              choices={([1, 2, 3, 4] as const).map((n) => ({ value: n, label: String(n) }))}
            />
            {time(ludo.turnSeconds, (v) => setL("turnSeconds", v))}
          </>
        ) : (
          <>
            <Segmented
              label={t("play.players")}
              value={domino.players}
              onChange={(v) => setD("players", v)}
              choices={[
                { value: 4, label: t("play.players4") },
                { value: 2, label: t("play.players2") },
              ]}
            />
            <Segmented
              label={t("play.target")}
              value={domino.targetScore}
              onChange={(v) => setD("targetScore", v)}
              choices={[50, 100, 150].map((n) => ({ value: n as DominoOptions["targetScore"], label: String(n) }))}
            />
            {time(domino.turnSeconds, (v) => setD("turnSeconds", v))}
            <Segmented
              label={t("play.opener")}
              value={domino.opener}
              onChange={(v) => setD("opener", v)}
              choices={[
                { value: "winner", label: t("play.openerWinner") },
                { value: "doubleSix", label: t("play.openerDoubleSix") },
              ]}
            />
            <Segmented
              label={t("play.scoring")}
              value={domino.scoring}
              onChange={(v) => setD("scoring", v)}
              choices={[
                { value: "opponents", label: t("play.scoringOpponents") },
                { value: "all", label: t("play.scoringAll") },
              ]}
            />
          </>
        )}

        {!solo && (
          <Segmented
            label={t("lobby.visibility")}
            value={visibility}
            onChange={setVisibility}
            hint={t(visibilityHint(visibility))}
            choices={VISIBILITIES.map((v) => ({ value: v, label: t(visibilityLabel(v)) }))}
          />
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {t(error)}
          </p>
        )}
        {/* Le bouton reste sous le pouce pendant qu'on fait défiler les réglages. */}
        <div className="sticky -bottom-5 -mx-5 bg-gradient-to-b from-transparent via-cafe-0/95 to-cafe-0 px-5 pt-4 pb-5">
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-card gold-button px-6 text-lg font-bold transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
          >
            {solo && <BotIcon className="size-6" />}
            {busy ? (solo ? t("play.soloStarting") : t("play.creating")) : solo ? (game === "ludo" ? t("play.soloLudo") : t("play.solo")) : t("lobby.open")}
          </button>
          {solo && <p className="mt-2 text-center text-xs text-cafe-muted">{t("play.soloHint")}</p>}
        </div>
      </div>
    </Sheet>
  );
}

/** « J'ai un code » : les 4 lettres envoyées par un ami. Un code ne sert qu'à une table, quel que soit le jeu. */
function JoinByCode({ onClose }: { onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  async function join(e: FormEvent) {
    e.preventDefault();
    preloadSounds();
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(clean)) {
      setError("play.error.invalid_code");
      return;
    }
    setBusy(true);
    setError(null);
    let last = "table_not_found";
    for (const g of GAME_IDS) {
      const res = await GAMES[g].call({ op: "join", code: clean });
      if (res.ok) {
        router.push(tablePath(g, clean));
        return;
      }
      last = res.error;
      if (res.error !== "table_not_found") break;
    }
    setBusy(false);
    setError(errorKey(last));
  }

  return (
    <Sheet onClose={onClose} label={t("lobby.codeTitle")}>
      <form onSubmit={join} className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-gilded text-xl font-bold">{t("lobby.codeTitle")}</h2>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex size-touch items-center justify-center rounded-full text-cafe-muted">
            <CloseIcon className="size-5" />
          </button>
        </div>
        <p className="text-sm text-ink-muted">{t("play.joinHint")}</p>
        <label className="sr-only" htmlFor="code">
          {t("play.code")}
        </label>
        <input
          id="code"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase())}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="ABCD"
          dir="ltr"
          className="min-h-16 cafe-input px-4 text-center text-3xl font-semibold tracking-[0.5em] uppercase placeholder:text-ink-muted/40"
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {t(error)}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex min-h-14 items-center justify-center rounded-card gold-button px-6 text-lg font-bold transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? t("play.joining") : t("play.joinButton")}
        </button>
      </form>
    </Sheet>
  );
}
