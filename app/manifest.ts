import type { MetadataRoute } from "next";

// Lets the companies page be installed as an app on a phone. On Android the
// installed app also appears in the share sheet (share_target), so a LinkedIn
// company can be saved with Share → Companies.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Companies",
    short_name: "Companies",
    description: "Companies saved from LinkedIn, with their careers pages.",
    id: "/companies",
    start_url: "/companies",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/companies/add",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
