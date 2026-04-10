import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Psittacus — Répétition théâtrale",
    short_name: "Psittacus",
    description: "Apprenez vos répliques de théâtre avec assistance vocale",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1117",
    theme_color: "#22c55e",
    categories: ["education", "entertainment"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Bibliothèque",
        url: "/",
        description: "Accéder à vos scripts",
      },
    ],
  };
}
