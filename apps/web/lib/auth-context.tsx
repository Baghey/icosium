"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./supabase";

export type AuthUser = { id: string; username: string; isGuest: boolean };

/** Résultat d'une inscription : connecté tout de suite, ou email de confirmation envoyé. */
export type SignUpResult = "signedIn" | "confirmEmail";

type AuthValue = {
  ready: boolean;
  user: AuthUser | null;
  /** Renvoie un jeton de session valide (rafraîchi si besoin), ou null si déconnecté. */
  getToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string, birthdate: string) => Promise<SignUpResult>;
  isUsernameAvailable: (username: string) => Promise<boolean>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

function toUser(session: Session | null, username: string | null): AuthUser | null {
  if (!session) return null;
  const meta = session.user.user_metadata as { username?: string };
  return {
    id: session.user.id,
    username: username ?? meta.username ?? "",
    isGuest: Boolean(session.user.is_anonymous),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase();
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // Le pseudo vient du profil public (créé par la base à l'inscription).
  const userId = session?.user.id ?? null;
  useEffect(() => {
    setUsername(null);
    if (!userId) return;
    let cancelled = false;
    supabase()
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setUsername(data.username as string);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const getToken = useCallback(async () => {
    const { data } = await supabase().auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      user: toUser(session, username),
      getToken,
      async signIn(email, password) {
        const { error } = await supabase().auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signUp(email, password, name, birthdate) {
        const { data, error } = await supabase().auth.signUp({
          email,
          password,
          options: { data: { username: name, birthdate }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        return data.session ? "signedIn" : "confirmEmail";
      },
      async isUsernameAvailable(name) {
        const { data, error } = await supabase().rpc("username_available", { name });
        if (error) throw error;
        return data === true;
      },
      async signInAsGuest() {
        const { error } = await supabase().auth.signInAnonymously({ options: { data: { age_confirmed: "true" } } });
        if (error) throw error;
      },
      async signOut() {
        await supabase().auth.signOut();
      },
    }),
    [getToken, ready, session, username],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
