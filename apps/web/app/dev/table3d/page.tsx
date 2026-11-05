"use client";

import type { PlacedTile } from "@icosium/shared";
import dynamic from "next/dynamic";
import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const Table3D = dynamic(() => import("@/components/domino/table3d"), { ssr: false });

/** Page de contrôle visuel de la table 3D (développement seulement). */
function Preview() {
  const params = useSearchParams();
  const n = Number(params.get("n") ?? "12");
  const chain: PlacedTile[] = [];
  let v = 6;
  for (let i = 0; i < n; i++) {
    const w = (v + 1 + ((i * 3) % 6)) % 7;
    const r = i === 0 ? 6 : w;
    chain.push({ tile: `${Math.min(v, r)}-${Math.max(v, r)}` as PlacedTile["tile"], left: v, right: r, seat: i % 4 });
    v = r;
  }
  return (
    <div className="cafe-bg fixed inset-0">
      <div className="absolute inset-x-2 top-0 bottom-48">
        <Table3D chain={chain} chainStart={Number(params.get("start") ?? "0")} targets={params.get("ghost") ? ["left", "right"] : []} onPick={() => undefined} freshTile={null} shuffleKey={params.get("shuffle") ?? "x"} players={4} reducedMotion={!params.get("shuffle")} />
      </div>
    </div>
  );
}

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}
