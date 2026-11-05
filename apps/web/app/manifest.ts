import type { MetadataRoute } from "next";
import { createTranslator } from "@icosium/i18n";

export default function manifest(): MetadataRoute.Manifest {
  const t = createTranslator("en");
  return {
    name: t("app.name"),
    short_name: t("app.name"),
    description: t("app.tagline"),
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6efe3",
    theme_color: "#2f9e78",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
