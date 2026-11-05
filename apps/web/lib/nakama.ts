"use client";

import { Client, Session } from "@heroiclabs/nakama-js";

const SESSION_KEY = "icosium.session";
const DEVICE_KEY = "icosium.deviceId";

/**
 * Client Nakama. L'app est servie par Caddy sur la même adresse que Nakama
 * (https://<hôte>:8443), donc on réutilise l'adresse de la page.
 */
export function createNakamaClient(): Client {
  const { hostname, port, protocol } = window.location;
  const useSSL = protocol === "https:";
  const effectivePort = port || (useSSL ? "443" : "80");
  return new Client(process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY || "defaultkey", hostname, effectivePort, useSSL);
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // stockage indisponible (navigation privée) : la session ne survivra pas au rechargement
  }
}

export function saveSession(session: Session | null): void {
  safeSet(SESSION_KEY, session ? JSON.stringify({ token: session.token, refresh: session.refresh_token }) : null);
}

/** Restaure la session enregistrée, en la rafraîchissant si elle a expiré. */
export async function restoreSession(client: Client): Promise<Session | null> {
  const raw = safeGet(SESSION_KEY);
  if (!raw) return null;
  try {
    const { token, refresh } = JSON.parse(raw) as { token: string; refresh: string };
    let session = Session.restore(token, refresh);
    const now = Date.now() / 1000;
    if (session.isrefreshexpired(now)) return null;
    if (session.isexpired(now + 60)) {
      session = await client.sessionRefresh(session);
      saveSession(session);
    }
    return session;
  } catch {
    return null;
  }
}

/** Identifiant de cet appareil pour le compte invité. */
export function getDeviceId(): string {
  const existing = safeGet(DEVICE_KEY);
  if (existing) return existing;
  const id = `icos-${crypto.randomUUID()}`;
  safeSet(DEVICE_KEY, id);
  return id;
}
