import type { MessageKey } from "@icosium/i18n";
import type { Presence } from "./social-context";

/** Ce qu'on affiche sous le nom : en ligne, à une table, en vocal, hors ligne. */
export function presenceKey(p: Presence | null): MessageKey {
  if (!p) return "social.offline";
  return p.status === "table" ? "social.atTable" : p.status === "voice" ? "social.inVoice" : "social.online";
}

/** Heure courte (aujourd'hui), « Hier », ou la date. */
export function shortTime(iso: string, locale: string, t: (k: MessageKey) => string): string {
  const d = new Date(iso);
  const days = Math.round((new Date(new Date().toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days === 0) return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return t("social.yesterday");
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

/** Aperçu du dernier message d'une conversation, dans la liste. */
export function lastPreview(
  c: { lastKind: string | null; lastBody: string | null; lastMeta: Record<string, unknown> | null },
  t: (k: MessageKey, v?: Record<string, string | number>) => string,
): string {
  switch (c.lastKind) {
    case "invite":
      return t("social.invitePreview");
    case "voice":
      return t("social.voicePreview");
    case "result":
      return t("social.resultPreview");
    case "call":
      return c.lastMeta?.status === "ended" ? t("social.callPreview") : t("social.missedCallPreview");
    case "system": {
      const m = c.lastMeta ?? {};
      const name = String(m.actorName ?? "");
      if (m.event === "created") return t("social.system.created", { name, title: String(m.title ?? "") });
      if (m.event === "added") return t("social.system.added", { name, names: ((m.names as string[] | undefined) ?? []).join(", ") });
      return t("social.system.left", { name });
    }
    default:
      return c.lastBody ?? "";
  }
}
