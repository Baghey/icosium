import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server-env";

export const dynamic = "force-dynamic";

async function reachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** État des trois services, pour l'écran d'accueil pendant les tests. */
export async function GET() {
  const [accounts, games, voice] = await Promise.all([
    reachable(`${serverEnv.nakamaUrl()}/healthcheck`),
    reachable(`${serverEnv.gameServerUrl()}/health`),
    reachable(`${serverEnv.livekitUrl()}/`),
  ]);
  return NextResponse.json({ accounts, games, voice }, { headers: { "cache-control": "no-store" } });
}
