import { VOICE_ROOM_MAX_PARTICIPANTS, isValidRoomName } from "@icosium/shared";
import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { NextResponse, type NextRequest } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { livekitApiUrl, serverEnv, verifySupabaseToken } from "@/lib/server-env";

export const dynamic = "force-dynamic";

// Anti-spam : 10 entrées en vocal par minute et par compte.
const allow = createRateLimiter(10, 60_000);

/** Donne un jeton LiveKit à une personne connectée (Supabase), pour un salon de 4 places max. */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const sessionToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!sessionToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const account = await verifySupabaseToken(sessionToken).catch(() => null);
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!allow(account.id)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { room?: unknown };
  const room = typeof body.room === "string" ? body.room : "";
  if (!isValidRoomName(room)) return NextResponse.json({ error: "invalid_room" }, { status: 400 });

  const rooms = new RoomServiceClient(livekitApiUrl(), serverEnv.livekitKey(), serverEnv.livekitSecret());
  try {
    await rooms.createRoom({ name: room, maxParticipants: VOICE_ROOM_MAX_PARTICIPANTS, emptyTimeout: 300 });
    const present = await rooms.listParticipants(room);
    const alreadyIn = present.some((p) => p.identity === account.id);
    if (!alreadyIn && present.length >= VOICE_ROOM_MAX_PARTICIPANTS) {
      return NextResponse.json({ error: "room_full" }, { status: 409 });
    }
  } catch {
    return NextResponse.json({ error: "voice_unavailable" }, { status: 503 });
  }

  const token = new AccessToken(serverEnv.livekitKey(), serverEnv.livekitSecret(), {
    identity: account.id,
    name: account.username,
    ttl: "2h",
  });
  token.addGrant({
    room,
    roomJoin: true,
    canSubscribe: true,
    canPublish: true,
    canPublishData: true,
    canPublishSources: [TrackSource.MICROPHONE],
  });

  return NextResponse.json({ token: await token.toJwt(), url: serverEnv.livekitUrl() }, { headers: { "cache-control": "no-store" } });
}
