// Fonction Supabase « domino » (Deno). Toute la logique est dans service.ts ; ce fichier ne fait
// que vérifier qui appelle, brancher la base Supabase, et répondre en JSON.
// Aucune dépendance : on parle à la base avec fetch (API REST de Supabase), ce qui démarre vite.
import type { DominoState } from "../_shared/domino/index.ts";
import { handle } from "./service.ts";
import type { DominoStore, SeatRow, StoredView, TableRow, TableStatus } from "./store.ts";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}

function rng(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] as number) / 4294967296;
}

type TableDb = { id: string; code: string; host_id: string; options: TableRow["options"]; status: TableStatus };
const toTable = (r: TableDb): TableRow => ({ id: r.id, code: r.code, hostId: r.host_id, options: r.options, status: r.status });
const TABLE_COLUMNS = "id,code,host_id,options,status";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

class DbError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** Appel à l'API REST de la base, avec la clé service (le serveur a tous les droits). */
async function rest<T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<{ data: T; headers: Headers }> {
  const headers: Record<string, string> = {
    apikey: SERVICE_KEY,
    authorization: `Bearer ${SERVICE_KEY}`,
    "content-type": "application/json",
  };
  if (init.prefer) headers.prefer = init.prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = (body ?? {}) as { code?: string; message?: string };
    throw new DbError(res.status, err.code ?? "", err.message ?? res.statusText);
  }
  return { data: body as T, headers: res.headers };
}

const isUniqueViolation = (err: unknown) => err instanceof DbError && err.code === "23505";

const store: DominoStore = {
  async username(userId) {
    const { data } = await rest<{ username: string }[]>(`profiles?id=eq.${userId}&select=username`);
    return data[0]?.username ?? "Player";
  },
  async countTablesSince(hostId, since) {
    const { headers } = await rest<unknown[]>(
      `domino_tables?host_id=eq.${hostId}&created_at=gte.${encodeURIComponent(since.toISOString())}&select=id&limit=1`,
      { prefer: "count=exact" },
    );
    const total = headers.get("content-range")?.split("/")[1];
    return total && total !== "*" ? Number(total) : 0;
  },
  async insertTable(row) {
    try {
      const { data } = await rest<TableDb[]>(`domino_tables?select=${TABLE_COLUMNS}`, {
        method: "POST",
        prefer: "return=representation",
        body: JSON.stringify({ code: row.code, host_id: row.hostId, options: row.options, bot_allowed: row.options.botAllowed }),
      });
      return data[0] ? toTable(data[0]) : null;
    } catch (err) {
      if (isUniqueViolation(err)) return null; // code déjà pris
      throw err;
    }
  },
  async tableByCode(code) {
    const { data } = await rest<TableDb[]>(`domino_tables?code=eq.${code}&select=${TABLE_COLUMNS}`);
    return data[0] ? toTable(data[0]) : null;
  },
  async tableById(id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { data } = await rest<TableDb[]>(`domino_tables?id=eq.${id}&select=${TABLE_COLUMNS}`);
    return data[0] ? toTable(data[0]) : null;
  },
  async seats(tableId) {
    const { data } = await rest<{ seat: number; user_id: string; username: string }[]>(
      `domino_seats?table_id=eq.${tableId}&select=seat,user_id,username&order=seat`,
    );
    return data.map((r) => ({ seat: r.seat, userId: r.user_id, username: r.username }));
  },
  async insertSeat(tableId, seat: SeatRow) {
    try {
      await rest("domino_seats", {
        method: "POST",
        body: JSON.stringify({ table_id: tableId, seat: seat.seat, user_id: seat.userId, username: seat.username }),
      });
      return true;
    } catch (err) {
      if (isUniqueViolation(err)) return false;
      throw err;
    }
  },
  async setStatus(tableId, status) {
    await rest(`domino_tables?id=eq.${tableId}`, { method: "PATCH", body: JSON.stringify({ status }) });
  },
  async loadGame(tableId) {
    const { data } = await rest<{ version: number; state: DominoState }[]>("rpc/domino_load", {
      method: "POST",
      body: JSON.stringify({ p_table: tableId }),
    });
    const row = data?.[0];
    return row ? { version: row.version, state: row.state } : null;
  },
  async commit(tableId, expected, state, view: StoredView, hands, status) {
    const { data } = await rest<boolean>("rpc/domino_commit", {
      method: "POST",
      body: JSON.stringify({ p_table: tableId, p_expected: expected, p_state: state, p_view: view, p_hands: hands, p_status: status }),
    });
    return data === true;
  },
};

/** Vérifie le jeton de la personne qui appelle et renvoie son identifiant. */
async function userIdFrom(req: Request): Promise<string | null> {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, authorization: `Bearer ${jwt}` } });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const userId = await userIdFrom(req);
  if (!userId) return json(401, { ok: false, error: "unauthorized" });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  try {
    const result = await handle({ store, rng, now: () => Date.now() }, userId, body);
    return json(result.status, result.body);
  } catch (err) {
    console.error("domino error", err);
    return json(500, { ok: false, error: "server_error" });
  }
});
