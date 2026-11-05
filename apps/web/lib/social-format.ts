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
