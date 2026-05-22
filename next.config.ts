import type { NextConfig } from "next";

// CSP is generated per-request in proxy.ts with a fresh nonce, so it isn't
// listed here. Other security headers are static and live in next.config.
const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

// Derive the Supabase host from the public env var so rotating the project
// or pointing at a staging Supabase doesn't require a config diff. Falls
// back to the current production hostname if env is missing at build time
// (e.g. local `next build` without .env.local).
const SUPABASE_HOST = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "idkikvkdijmifaskobeh.supabase.co";
  try {
    return new URL(url).hostname;
  } catch {
    return "idkikvkdijmifaskobeh.supabase.co";
  }
})();

const nextConfig: NextConfig = {
  // Server Actions default to 1 MB of FormData body. Mobile camera photos
  // routinely exceed this — bump to 15 MB so admin image uploads succeed.
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: SUPABASE_HOST,
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // ZERO Vercel image transformations. We serve the originals straight
    // from the Supabase Storage public CDN instead of going through
    // Vercel's optimizer — the free tier caps optimizer transforms at
    // 5000/month and a growing catalog burns through that. The stored
    // files are already web-sized (median ~220 KB, crawler photos capped
    // at 1024px, admin uploads ≤15 MB but typically a few hundred KB), so
    // skipping resize/webp is an acceptable trade for staying free.
    //
    // The qualities/deviceSizes/formats knobs below are inert while
    // unoptimized=true; kept so flipping back to the optimizer (e.g. on
    // a paid plan) restores the tuned budget without re-deriving it.
    unoptimized: true,
    formats: ["image/webp"],
    qualities: [75],
    deviceSizes: [640, 828, 1080, 1920],
    imageSizes: [96, 256],
    minimumCacheTTL: 2678400, // 31 days
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
