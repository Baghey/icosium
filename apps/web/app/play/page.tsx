"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { LobbyView } from "@/components/lobby/lobby-view";
import { useAuth } from "@/lib/auth-context";
import { useLobby } from "@/lib/lobby";
import { useSocial } from "@/lib/social-context";

export default function PlayPage() {
  return (
    <AppShell>
      <Lobby />
    </AppShell>
  );
}

/** Le lobby en direct : les tables relues régulièrement, mes amis pour les repérer. */
function Lobby() {
  const { user } = useAuth();
  const { friends } = useSocial();
  const { tables, failed } = useLobby();
  const friendIds = useMemo(() => new Set(friends.filter((f) => f.status === "accepted").map((f) => f.id)), [friends]);
  return <LobbyView tables={tables} failed={failed} meId={user?.id ?? null} friendIds={friendIds} />;
}
