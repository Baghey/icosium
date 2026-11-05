"use client";

import { avatarOf } from "@/lib/avatar";
import type { Presence } from "@/lib/social-context";

/** Avatar rond avec anneau doré et, si on la connaît, la pastille de présence. */
export function PersonAvatar({ id, size = 48, presence }: { id: string; size?: number; presence?: Presence | null | undefined }) {
  const dot = presence === undefined ? null : presence ? (presence.status === "table" ? "bg-gold" : presence.status === "voice" ? "bg-mic-on" : "bg-online") : "bg-cafe-muted/50";
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={avatarOf(id)} alt="" className="size-full rounded-full border-2 border-gold/60 object-cover shadow-[0_3px_10px_rgb(0_0_0/0.45)]" />
      {dot && (
        <span
          className={`absolute -end-0.5 -bottom-0.5 rounded-full ring-[3px] ring-cafe-1 ${dot} ${presence ? "shadow-[0_0_8px_currentColor]" : ""}`}
          style={{ width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26) }}
          aria-hidden="true"
        />
      )}
    </span>
  );
}
