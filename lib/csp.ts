// Content-Security-Policy, shared by next.config.ts (storefront) and
// proxy.ts (admin). Plain relative imports only: next.config loads this.
//
// Two flavours:
// - With a nonce (admin): 'nonce-…' + 'strict-dynamic'. Needs a fresh
//   nonce per request, which forces dynamic rendering. Fine for admin,
//   which is per-user anyway.
// - Without a nonce (storefront): 'self' 'unsafe-inline' + a host
//   allowlist. A per-request nonce made every public page render on each
//   visit (no ISR, no CDN cache), which was most of the Vercel CPU and the
//   Supabase DB egress. Inline scripts on public pages are framework
//   bootstrap, the Meta Pixel snippet and JSON-LD; none take user input.
export function buildCsp({
  nonce,
  supabaseOrigin,
  isDev,
}: {
  nonce?: string;
  supabaseOrigin: string;
  isDev: boolean;
}): string {
  // Browsers that understand strict-dynamic ignore host lists and
  // 'unsafe-inline', so the nonce policy is pure nonce gating. Dev needs
  // eval for React's dev runtime + Turbopack HMR; prod never does.
  const scriptSrc = (
    nonce
      ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]
      : [
          "'self'",
          "'unsafe-inline'",
          "https://connect.facebook.net",
          "https://va.vercel-scripts.com",
        ]
  )
    .concat(isDev ? ["'unsafe-eval'"] : [])
    .join(" ");
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src 'self' data: blob: ${supabaseOrigin} https://www.facebook.com`,
    `connect-src 'self' ${supabaseOrigin} https://api.exchangerate.host https://dolarapi.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://www.facebook.com${isDev ? " ws: http://localhost:*" : ""}`,
    // Meta Pixel sends events that carry custom data (Lead, InitiateCheckout)
    // as a form POST into a hidden iframe on www.facebook.com, so both
    // directives must allow it or those events are silently dropped.
    "frame-src 'self' https://www.facebook.com",
    "form-action 'self' https://api.whatsapp.com https://wa.me https://www.facebook.com",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}
