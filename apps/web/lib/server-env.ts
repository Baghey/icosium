import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}

export const serverEnv = {
  nakamaUrl: () => process.env.NAKAMA_INTERNAL_URL ?? "http://127.0.0.1:7350",
  livekitUrl: () => process.env.LIVEKIT_INTERNAL_URL ?? "http://127.0.0.1:7880",
  livekitKey: () => required("LIVEKIT_API_KEY"),
  livekitSecret: () => required("LIVEKIT_API_SECRET"),
  gameServerUrl: () => `http://127.0.0.1:${process.env.GAME_SERVER_PORT ?? "2567"}`,
};

export type NakamaAccount = { id: string; username: string };

/** Vérifie un jeton de session auprès de Nakama. Renvoie le compte, ou null si le jeton est refusé. */
export async function verifyNakamaToken(token: string): Promise<NakamaAccount | null> {
  const res = await fetch(`${serverEnv.nakamaUrl()}/v2/account`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { user?: { id?: string; username?: string; display_name?: string } };
  if (!body.user?.id) return null;
  return { id: body.user.id, username: body.user.display_name || body.user.username || "Player" };
}
