"use client";

import { notFound } from "next/navigation";
import { playClack, playYourTurn } from "@/lib/sound";

/** Page d'écoute des sons (développement seulement). */
export default function SoundsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const btn = "gold-button min-h-touch rounded-full px-5 font-bold";
  return (
    <main className="flex flex-col gap-3 p-6">
      <button type="button" className={btn} onClick={() => playClack()}>clack</button>
      <button type="button" className={btn} onClick={() => playClack(true)}>clack fort</button>
      <button type="button" className={btn} onClick={() => playYourTurn()}>à toi</button>
    </main>
  );
}
