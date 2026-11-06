import type { MessageKey } from "@icosium/i18n";
import { type CallResult, callDomino } from "./domino-client";
import { callLudo } from "./ludo-client";

/**
 * Les jeux qui ont des tables, au même endroit. Le lobby, les invitations et « mes tables »
 * passent tous par cette liste : un nouveau jeu (échecs, Ronda…) s'ajoute ici, et côté base
 * dans private.lobby_games() (migration du lobby).
 */
export type GameId = "domino" | "ludo";

export type GameDef = {
  id: GameId;
  name: MessageKey;
  /** Une phrase pour le choix du jeu. */
  tagline: MessageKey;
  /** Adresse d'une table : `${path}/${code}`. */
  path: string;
  minPlayers: number;
  maxPlayers: number;
  call: (body: Record<string, unknown>) => Promise<CallResult>;
};

export const GAMES: Record<GameId, GameDef> = {
  domino: {
    id: "domino",
    name: "play.gameDomino",
    tagline: "lobby.taglineDomino",
    path: "/play",
    minPlayers: 2,
    maxPlayers: 4,
    call: callDomino,
  },
  ludo: {
    id: "ludo",
    name: "play.gameLudo",
    tagline: "lobby.taglineLudo",
    path: "/ludo",
    minPlayers: 2,
    maxPlayers: 4,
    call: callLudo,
  },
};

export const GAME_IDS = Object.keys(GAMES) as GameId[];

export const isGameId = (v: unknown): v is GameId => typeof v === "string" && v in GAMES;

export const tablePath = (game: GameId, code: string) => `${GAMES[game].path}/${code}`;
