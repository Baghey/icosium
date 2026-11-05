"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MessageKey } from "@icosium/i18n";
import { useT } from "@/lib/i18n";

const ITEMS: { href: string; label: MessageKey }[] = [
  { href: "/", label: "nav.home" },
  { href: "/play", label: "nav.play" },
  { href: "/voice", label: "nav.voice" },
  { href: "/profile", label: "nav.profile" },
];

/** Navigation en bas de l'écran, à portée de pouce. */
export function BottomNav() {
  const t = useT();
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-xl">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 items-center justify-center text-sm font-medium transition-colors duration-200 ${
                  active ? "text-mint" : "text-ink-muted"
                }`}
              >
                {t(item.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
