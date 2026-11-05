"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MessageKey } from "@icosium/i18n";
import type { ComponentType } from "react";
import { useT } from "@/lib/i18n";
import { useSocial } from "@/lib/social-context";
import { CafeIcon, DominoIcon, FriendsIcon, ProfileIcon, VoiceIcon } from "./cafe-icons";

type Item = { href: string; label: MessageKey; Icon: ComponentType<{ className?: string }> };

const ITEMS: Item[] = [
  { href: "/", label: "nav.home", Icon: CafeIcon },
  { href: "/play", label: "nav.play", Icon: DominoIcon },
  { href: "/friends", label: "nav.friends", Icon: FriendsIcon },
  { href: "/voice", label: "nav.voice", Icon: VoiceIcon },
  { href: "/profile", label: "nav.profile", Icon: ProfileIcon },
];

/** Navigation en bas de l'écran, à portée de pouce : cinq onglets, l'actif s'allume en or. */
export function BottomNav() {
  const t = useT();
  const pathname = usePathname();
  const { unread, pendingRequests } = useSocial();
  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/25 bg-[linear-gradient(180deg,rgb(30_20_13/0.94),rgb(12_8_5/0.98))] pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgb(0_0_0/0.45)] backdrop-blur-md"
    >
      <ul className="mx-auto flex max-w-xl">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const badge = href === "/friends" ? unread + pendingRequests : 0;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors duration-200 ${
                  active ? "text-gold-light" : "text-cafe-muted"
                }`}
              >
                {/* Filet doré au-dessus de l'onglet actif. */}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-5 top-0 h-[2px] rounded-full bg-gold shadow-[0_0_10px_var(--gold)] transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`}
                />
                <span className="relative">
                  <Icon className={`size-6 transition-transform duration-200 ${active ? "scale-110 drop-shadow-[0_0_6px_rgb(216_167_72/0.6)]" : ""}`} />
                  {badge > 0 && (
                    <span className="animate-pop absolute -end-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e0533d] px-1 text-[10px] leading-none font-bold text-white ring-2 ring-cafe-0">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                {t(label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
