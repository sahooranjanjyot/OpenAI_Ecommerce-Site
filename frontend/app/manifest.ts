/**
 * PWA Manifest (G-172)
 * Enables Add to Home Screen, offline support, splash screens
 */

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "GroceryOS",
    short_name:       "GroceryOS",
    description:      "Fresh groceries delivered — shop online or in-store",
    start_url:        "/",
    display:          "standalone",
    background_color: "#0f172a",
    theme_color:      "#7c3aed",
    orientation:      "portrait-primary",
    scope:            "/",
    lang:             "en-GB",
    categories:       ["food", "shopping", "lifestyle"],
    icons: [
      {
        src:     "/icons/icon-72.png",
        sizes:   "72x72",
        type:    "image/png",
        purpose: "any",
      },
      {
        src:     "/icons/icon-96.png",
        sizes:   "96x96",
        type:    "image/png",
        purpose: "any",
      },
      {
        src:     "/icons/icon-128.png",
        sizes:   "128x128",
        type:    "image/png",
        purpose: "any",
      },
      {
        src:     "/icons/icon-144.png",
        sizes:   "144x144",
        type:    "image/png",
        purpose: "any",
      },
      {
        src:     "/icons/icon-192.png",
        sizes:   "192x192",
        type:    "image/png",
        purpose: "any maskable",
      },
      {
        src:     "/icons/icon-512.png",
        sizes:   "512x512",
        type:    "image/png",
        purpose: "any maskable",
      },
    ],
    screenshots: [
      {
        src:          "/screenshots/home.png",
        sizes:        "390x844",
        type:         "image/png",
        form_factor:  "narrow",
        label:        "GroceryOS Home",
      },
    ],
    shortcuts: [
      {
        name:      "Shop Now",
        url:       "/",
        icons:     [{ src: "/icons/icon-96.png", sizes: "96x96" }],
      },
      {
        name:      "Track Order",
        url:       "/track",
        icons:     [{ src: "/icons/icon-96.png", sizes: "96x96" }],
      },
    ],
  };
}
