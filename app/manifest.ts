import { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lm3allem Terminal",
    short_name: "Lm3allem",
    description: "Lm3allem Terminal — Internal Management Platform",
    start_url: "/",
    display: "standalone",
    background_color: "#0f0f0f",
    theme_color: "#C9A84C",
    orientation: "any",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}