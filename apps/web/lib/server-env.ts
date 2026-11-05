import "server-only";
import { createClient } from "@supabase/supabase-js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}

export const serverEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseKey: () => required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  /** Adresse wss:// du projet LiveKit Cloud (ex. wss://icosium-xxxx.livekit.cloud). */
  livekitUrl: () => required("LIVEKIT_URL"),
  livekitKey: () => required("LIVEKIT_API_KEY"),
  livekitSecret: () => required("LIVEKIT_API_SECRET"),
};

/** Adresse https:// de l'API LiveKit, déduite de l'adresse wss://. */
export function livekitApiUrl(): string {
  return serverEnv.livekitUrl().replace(/^ws(s?):\/\//, "http$1://");
}

export type Account = { id: string; username: string };

/** Vérifie un jeton de session Supabase. Renvoie le compte, ou null si le jeton est refusé. */
export async function verifySupabaseToken(token: string): Promise<Account | null> {
  const client = createClient(serverEnv.supabaseUrl(), serverEnv.supabaseKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await client.from("profiles").select("username").eq("id", data.user.id).maybeSingle();
  return { id: data.user.id, username: (profile?.username as string | undefined) ?? "Player" };
}
