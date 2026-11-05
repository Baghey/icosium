"use client";

import { type PlacedTile, type TileId, fullSet, parseTile, tileId } from "@icosium/shared";
import dynamic from "next/dynamic";
import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const Table3D = dynamic(() => import("@/components/domino/table3d"), { ssr: false });

/** Page de contrôle visuel de la table 3D (développement seulement). */
function Preview() {
  const params = useSearchParams();
  const n = Number(params.get("n") ?? "12");
  // Une vraie partie au hasard (graine `seed`) : pierres jouables posées à un bout au hasard.
  let seed = Number(params.get("seed") ?? "7") >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pool = fullSet();
  const first = parseTile(pool.splice(Math.floor(rng() * pool.length), 1)[0] as TileId);
  const chain: PlacedTile[] = [{ tile: tileId(first[0], first[1]), left: first[0], right: first[1], seat: 0 }];
  let start = 0;
  while (chain.length < n) {
    const left = (chain[0] as PlacedTile).left;
    const right = (chain[chain.length - 1] as PlacedTile).right;
    const moves: { i: number; end: "left" | "right" }[] = [];
    pool.forEach((t, i) => {
      const [a, b] = parseTile(t);
      if (a === left || b === left) moves.push({ i, end: "left" });
      if (a === right || b === right) moves.push({ i, end: "right" });
    });
    const m = moves[Math.floor(rng() * moves.length)];
    if (!m) break;
    const [a, b] = parseTile(pool.splice(m.i, 1)[0] as TileId);
    if (m.end === "left") {
      chain.unshift({ tile: tileId(a, b), left: a === left ? b : a, right: left, seat: 1 });
      start += 1;
    } else chain.push({ tile: tileId(a, b), left: right, right: a === right ? b : a, seat: 0 });
  }
  return (
    <div className="cafe-bg fixed inset-0">
      <div className="absolute inset-x-0 top-24 bottom-48">
        <Table3D chain={chain} chainStart={start} targets={params.get("ghost") ? ["left", "right"] : []} onPick={() => undefined} freshTile={null} shuffleKey={params.get("shuffle") ?? "x"} players={4} reducedMotion={!params.get("shuffle")} glowEnds={params.get("glow") ? ["left", "right"] : []} />
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
