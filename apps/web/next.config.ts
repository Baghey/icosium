import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// En local, un seul fichier .env à la racine du dépôt (voir .env.example).
// Sur Vercel, les variables sont réglées dans le tableau de bord du projet.
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  transpilePackages: ["@icosium/i18n", "@icosium/shared"],
  poweredByHeader: false,
};

export default nextConfig;
