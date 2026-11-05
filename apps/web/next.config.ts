import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// Un seul fichier .env, à la racine du dépôt (voir .env.example).
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const lanIp = process.env.ICOSIUM_LAN_IP;

const nextConfig: NextConfig = {
  transpilePackages: ["@icosium/i18n", "@icosium/shared"],
  // L'app est ouverte via https://<IP>:8443 (Caddy) : on autorise cette origine en dev.
  allowedDevOrigins: lanIp ? [lanIp, "localhost"] : ["localhost"],
  env: {
    NEXT_PUBLIC_NAKAMA_SERVER_KEY: process.env.NAKAMA_SERVER_KEY ?? "",
  },
  poweredByHeader: false,
};

export default nextConfig;
