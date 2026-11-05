import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Charge le fichier .env à la racine du dépôt, s'il existe (jamais de secret dans le code). */
export function loadRootEnv(): void {
  const path = fileURLToPath(new URL("../../../.env", import.meta.url));
  if (existsSync(path)) process.loadEnvFile(path);
}
