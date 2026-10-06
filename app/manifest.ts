import { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lm3allem Terminal",
    short_name: "Lm3allem",
    description: "Lm3allem Terminal - Internal Management Platform",
    start_url: "/ar",
    scope: "/",
    lang: "ar",
    dir: "rtl",
    display: "standalone",
    background_color: "#353535",
    theme_color: "#353535",
    orientation: "any",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  }
}
