import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Claw Kitchen",
    short_name: "Claw Kitchen",
    description: "Local-first UI for authoring ClawRecipes recipes and scaffolding agents/teams.",
    start_url: "/",
    display: "standalone",
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
