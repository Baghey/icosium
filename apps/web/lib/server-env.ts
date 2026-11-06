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

/** Client Supabase qui agit au nom de la personne (la RLS et les fonctions vérifient ses droits). */
function asUser(token: string) {
  return createClient(serverEnv.supabaseUrl(), serverEnv.supabaseKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    // « Authorization » avec une majuscule : en minuscule, supabase-js envoie le jeton deux fois et
    // Supabase le refuse.
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/** Cette personne fait-elle partie de cet appel, et l'appel a-t-il décroché ? */
export async function canJoinCall(token: string, callId: string): Promise<boolean> {
  const { data, error } = await asUser(token).rpc("can_join_call", { p_call: callId });
  return !error && data === true;
}

/** Vérifie un jeton de session Supabase. Renvoie le compte, ou null si le jeton est refusé. */
export async function verifySupabaseToken(token: string): Promise<Account | null> {
  const client = asUser(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await client.from("profiles").select("username").eq("id", data.user.id).maybeSingle();
  return { id: data.user.id, username: (profile?.username as string | undefined) ?? "Player" };
}
