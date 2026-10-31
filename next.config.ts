import type { NextConfig } from "next";
import { buildCsp } from "./lib/csp";

// Static security headers. The storefront CSP lives here too (no nonce, so
// pages stay cacheable); /admin gets a per-request nonce CSP in proxy.ts.
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
    // Storage photos go through the Vercel optimizer. Serving the originals
    // straight from Supabase (unoptimized) made every page view count as
    // Supabase cached egress: 10.4 GB in the Oct 2026 cycle against a 5 GB
    // Free quota. Now Vercel fetches each original once per width, caches
    // the WebP for 31 days and serves every later visitor from its CDN.
    //
    // Budget: Vercel Hobby includes 5K transformations/month (one per cache
    // miss per src+width). Past that, NEW variants return 402 while cached
    // ones keep working. ~1.1K photos x 2 to 3 widths stays under, so keep
    // the width lists short: each extra width is another possible
    // transformation and another fetch of the original from Supabase.
    // 256 = thumbs (cart, admin), 640 = catalog cards, 1200 = detail,
    // zoom, OG and retina desktop cards.
    formats: ["image/webp"],
    qualities: [75],
    deviceSizes: [640, 1200],
    imageSizes: [256],
    // Object keys are never reused (uploads get a timestamped name), so a
    // cached variant never goes stale; the long TTL stops re-fetches.
    minimumCacheTTL: 2678400, // 31 days
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Everything except /admin, which sets its own nonce CSP.
        source: "/((?!admin(?:/|$)).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildCsp({
              supabaseOrigin: `https://${SUPABASE_HOST}`,
              isDev: process.env.NODE_ENV !== "production",
            }),
          },
        ],
      },
      {
        source: "/checkout/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default nextConfig;
