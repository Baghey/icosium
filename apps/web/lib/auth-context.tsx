"use client";

import type { Client, Session } from "@heroiclabs/nakama-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createNakamaClient, getDeviceId, restoreSession, saveSession } from "./nakama";

export type AuthUser = { id: string; username: string; isGuest: boolean };

type AuthValue = {
  ready: boolean;
  user: AuthUser | null;
  /** Renvoie un jeton de session valide (rafraîchi si besoin), ou null si déconnecté. */
  getToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string, birthdate: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

function toUser(session: Session): AuthUser {
  const vars = (session.vars ?? {}) as Record<string, string>;
  return {
    id: session.user_id ?? "",
    username: session.username ?? "",
    isGuest: vars.age_confirmed === "true",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<Client | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const client = useCallback((): Client => {
    if (!clientRef.current) clientRef.current = createNakamaClient();
    return clientRef.current;
  }, []);

  const adopt = useCallback((session: Session | null) => {
    sessionRef.current = session;
    saveSession(session);
    setUser(session ? toUser(session) : null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    restoreSession(client()).then((session) => {
      if (cancelled) return;
      sessionRef.current = session;
      setUser(session ? toUser(session) : null);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const getToken = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return null;
    const now = Date.now() / 1000;
    if (session.isexpired(now + 60)) {
      try {
        const fresh = await client().sessionRefresh(session);
        adopt(fresh);
        return fresh.token;
      } catch {
        adopt(null);
        return null;
      }
    }
    return session.token;
  }, [adopt, client]);

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      user,
      getToken,
      async signIn(email, password) {
        adopt(await client().authenticateEmail(email, password, false));
      },
      async signUp(email, password, username, birthdate) {
        adopt(await client().authenticateEmail(email, password, true, username, { birthdate }));
      },
      async signInAsGuest() {
        // Le pseudo n'est utilisé qu'à la création du compte invité.
        const guestName = `guest_${Math.random().toString(36).slice(2, 8)}`;
        adopt(await client().authenticateDevice(getDeviceId(), true, guestName, { age_confirmed: "true" }));
      },
      async signOut() {
        const session = sessionRef.current;
        adopt(null);
        if (session) {
          try {
            await client().sessionLogout(session, session.token, session.refresh_token);
          } catch {
            // déjà déconnecté côté serveur : rien à faire
          }
        }
      },
    }),
    [adopt, client, getToken, ready, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
