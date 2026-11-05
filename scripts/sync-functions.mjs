// Copie les règles des jeux (packages/shared/src/<jeu>) dans supabase/functions/_shared/<jeu>,
// pour que les fonctions Supabase (Deno) utilisent exactement le même code que l'app.
// Lancer après chaque modification des règles : pnpm sync:functions
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const game of ["domino"]) {
  const from = join(root, "packages/shared/src", game);
  const to = join(root, "supabase/functions/_shared", game);
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  for (const file of readdirSync(from)) cpSync(join(from, file), join(to, file));
  console.log(`synced ${game}`);
}
