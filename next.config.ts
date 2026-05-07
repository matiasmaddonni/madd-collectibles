import type { NextConfig } from "next";

// Content-Security-Policy. Allowlist:
// - 'self' for own assets
// - inline scripts/styles required for Next.js hydration + Meta Pixel snippet
// - Vercel Analytics, Meta Pixel script + image beacon
// - Supabase Storage (product + category images), data: URIs (Next/Image blur),
//   blob: (next/image processing)
// - WhatsApp wa.me / api.whatsapp.com for outbound deeplinks (form-action)
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co https://www.facebook.com",
  "connect-src 'self' https://*.supabase.co https://api.exchangerate.host https://va.vercel-scripts.com https://vitals.vercel-insights.com https://www.facebook.com",
  "frame-src 'self'",
  "form-action 'self' https://api.whatsapp.com https://wa.me",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
];

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
        hostname: "idkikvkdijmifaskobeh.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
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
