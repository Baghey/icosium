"use client";

import { notFound } from "next/navigation";
import { DominoBack, DominoTile } from "@/components/domino/tile";

/** Page de contrôle visuel des pierres (développement seulement). */
export default function TilesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="felt-table flex flex-wrap items-center gap-3 p-4" dir="ltr">
      {[[6, 6], [5, 3], [4, 2], [1, 0]].map(([a, b]) => (
        <DominoTile key={`${a}${b}`} a={a!} b={b!} size={34} />
      ))}
      <DominoBack size={34} />
      <DominoTile a={6} b={5} orientation="horizontal" size={34} />
      <DominoTile a={3} b={3} orientation="horizontal" size={34} />
    </main>
  );
}
