// Build a Vercel/Next optimizer URL for places that can't render
// next/image (OG/Twitter metadata, plain <img> in the admin). Going
// through /_next/image means Supabase serves the original once per width
// and Vercel's CDN serves everyone else, instead of every request counting
// as Supabase egress.
//
// `width` must be one of images.deviceSizes / imageSizes in next.config.ts
// (640, 1200 / 256) or the optimizer rejects the request. URLs
// outside Supabase public storage (e.g. crawler candidates still on eBay)
// aren't in remotePatterns, so they're returned untouched.
const PUBLIC_STORAGE_MARKER = ".supabase.co/storage/v1/object/public/";

export function optimizedImageUrl(
  src: string,
  width: 256 | 640 | 1200,
): string {
  if (!src.includes(PUBLIC_STORAGE_MARKER)) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}
