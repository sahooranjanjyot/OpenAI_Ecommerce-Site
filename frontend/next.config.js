/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Security Headers (G-009, G-010) — applied via headers() config ──────────
  // Note: Full headers also applied in middleware.ts for runtime control
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",        value: "DENY" },
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
          { key: "X-DNS-Prefetch-Control",  value: "on" },
        ],
      },
    ];
  },

  // ── Redirects — legacy route support (G-017 API versioning) ─────────────────
  async redirects() {
    return [
      // v1 API alias — all v1 routes proxy to current routes
      { source: "/api/v1/:path*", destination: "/api/:path*", permanent: false },
    ];
  },

  // ── Image optimisation (G-010, G-037 alt text) ──────────────────────────────
  images: {
    domains: ["images.unsplash.com", "res.cloudinary.com", "cdn.groceryos.example.com"],
    formats: ["image/avif", "image/webp"],
  },

  // ── Performance (G-127, G-128, G-126) ────────────────────────────────────────
  compress: true,
  poweredByHeader: false, // Hide X-Powered-By for security obscurity

  // ── Environment variable exposure to client (safe values only) ───────────────
  env: {
    NEXT_PUBLIC_APP_VERSION: "1.0.0",
  },

  // ── TypeScript strict build errors ───────────────────────────────────────────
  typescript: {
    ignoreBuildErrors: false,
  },

  // ── ESLint on build ───────────────────────────────────────────────────────────
  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;
