"use client";

import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import type { PlacedTile } from "@icosium/shared";

const Table3D = dynamic(() => import("@/components/domino/table3d"), { ssr: false });

const p = (l: number, r: number): PlacedTile => ({ tile: `${Math.min(l, r)}-${Math.max(l, r)}` as PlacedTile["tile"], left: l, right: r, seat: 0 });
// Une longue chaîne de contrôle (développement) : chaque pierre doit toucher sa voisine par le même chiffre.
const CHAIN: PlacedTile[] = [p(0, 1), p(1, 1), p(1, 3), p(3, 3), p(3, 6), p(6, 6), p(6, 2), p(2, 1), p(1, 6), p(6, 3), p(3, 2), p(2, 2), p(2, 5), p(5, 5), p(5, 4), p(4, 4), p(4, 6), p(6, 5), p(5, 3), p(3, 4), p(4, 1), p(1, 5)];

export default function ChainPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const n = Number(new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("n") ?? CHAIN.length);
  return (
    <main className="fixed inset-0">
      <Table3D chain={CHAIN.slice(0, n)} chainStart={5} targets={[]} onPick={() => {}} freshTile={null} shuffleKey="x" players={4} reducedMotion={n > 0} glowEnds={[]} landscape={typeof window !== "undefined" && window.innerWidth > window.innerHeight} />
    </main>
  );
}
