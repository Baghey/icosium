import { NextResponse } from "next/server";
import { livekitApiUrl, serverEnv } from "@/lib/server-env";

export const dynamic = "force-dynamic";

async function reachable(url: string, headers?: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch(url, { cache: "no-store", headers, signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** État des services, pour l'écran d'accueil pendant les tests. */
export async function GET() {
  const [accounts, voice] = await Promise.all([
    reachable(`${serverEnv.supabaseUrl()}/auth/v1/health`, { apikey: serverEnv.supabaseKey() }),
    reachable(livekitApiUrl()).catch(() => false),
  ]);
  return NextResponse.json({ accounts, voice }, { headers: { "cache-control": "no-store" } });
}
