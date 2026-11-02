import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Campus Student Dashboard",
    short_name: "Campus",
    description: "Your classes, assignments, and study tools in one place.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#12121a",
    theme_color: "#12121a",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
