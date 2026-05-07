# Security baseline

State of security controls after pre-launch hardening.

## Network / HTTP

- **CSP** set globally via `next.config.ts → headers()`. Allowlist:
  - Scripts: `'self'`, `'unsafe-inline'` (for the inline Pixel snippet + Next.js bootstrap), Vercel Analytics, Meta Pixel.
  - Styles: `'self'`, `'unsafe-inline'`, Google Fonts.
  - Images: `'self'`, `data:`, `blob:`, `*.supabase.co`, `www.facebook.com`.
  - Connect: `'self'`, `*.supabase.co`, exchangerate.host, Vercel Insights, Facebook.
  - `frame-ancestors 'none'` (clickjacking).
  - `form-action` allows wa.me + api.whatsapp.com (cart deeplink).
- **Other security headers**: `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Permissions-Policy: geolocation=(), microphone=(), camera=()`.

## Auth

- **Admin login** (`app/admin/login/page.tsx`): supabase password auth. `?next=` redirect now allow-listed to same-origin paths starting with a single `/` (rejects `//evil.com`, `https:...`, `\\` variants).
- **Admin route gate** (`proxy.ts`): middleware enforces auth on `/admin/:path*` before any handler runs. Server actions in `app/admin/actions.ts` re-check via `requireUser()` (defense-in-depth).
- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`): used only in files importing `"server-only"` (`lib/supabase/admin.ts`, `lib/queries.ts`) or in offline `scripts/*`. No client-bundle path.

## Public server actions

- `recordCheckoutIntent` (`app/checkout/actions.ts`):
  - Schema-validates payload (`MAX_ITEMS=50`, `MAX_NAME=200`, currency whitelist, integer qty 1-999).
  - HTML-escapes every user field interpolated into the Resend HTML body.
  - **Per-IP rate limit**: 5 requests / 60 s sliding window via in-memory `Map` keyed by `x-forwarded-for`. Best-effort defense — survives within a warm serverless instance, resets on cold start. Add Vercel KV / Upstash backing later for cross-instance enforcement.
  - Recipient/sender are env-driven (`EMAIL_FROM`, `EMAIL_TO`) — never user-controlled.

## Database (Supabase RLS)

Re-asserted in migration `005_security_baseline.sql`.

| Table | RLS | Anon SELECT | Anon write |
|---|---|---|---|
| `brands` | ON | yes (read-only) | denied |
| `product_lines` | ON | yes (read-only) | denied |
| `series` | ON | yes (read-only) | denied |
| `products` | ON | yes (read-only) | denied |
| `product_images` | ON | yes (read-only) | denied |
| `checkout_intents` | ON | denied (no policy) | denied |

`cost_price` is excluded from public reads via the `public_products` view (`security_invoker = true`).

All writes go through server actions running with the service role (which bypasses RLS). The browser never sees the service role key.

## Storage

- Public bucket `category-images` is read-only via the supabase-js anon client. Listing requires service role (used in `lib/queries.ts → listCategoryImages` server-side).

## Search & filter inputs

- `?linea=`, `?serie=`, `?excluir=`: validated via `safeSlugs` (`/^[a-z0-9-]+$/`) before being interpolated into PostgREST `.in` clauses.
- `?condicion=`: filtered against `VALID_CONDITIONS` whitelist.
- `?q=`: strips `[%,()]` before being concatenated into the OR filter; series + line lookups happen via id-mapped queries, not interpolation.
- `?orden=`, `?pagina=`: mapped to enum / coerced to int.

## Outbound integrations

- **WhatsApp** (`lib/contact.ts → waLink`): phone stripped to digits; message URL-encoded.
- **Resend** (`lib/email.ts`): from/to env-driven; HTML body escaped.
- **Currency** (`lib/currency.ts`): hardcoded provider URL.
- **Twilio bot** (n8n): runs on a separate tunnel/host. Reads Supabase via the public anon key only.

## Pre-release checklist (NOT yet done — leave to user)

- [ ] **Twilio webhook signature verification** — add HMAC check to the n8n webhook node before going off the sandbox so spoofed `X-Twilio-Signature` requests can't trigger replies on your dime.
- [ ] **Rotate the GitHub PAT** previously embedded in `.git/config` (`ghp_LD4Gc...`). Replace remote URL with `https://github.com/<owner>/<repo>.git`, switch to Keychain credential helper.
- [ ] **Set `NEXT_PUBLIC_SITE_URL`** on Vercel Production + Preview when the final domain is live so OG/Twitter URLs and the sitemap resolve correctly.

## Things explicitly NOT implemented (by choice)

- Cookie banner — Vercel Analytics is cookie-less and AR doesn't require it. Add only if Meta Pixel goes live targeting EU traffic.
- Audit logs / session replay — out of scope until a real abuse signal appears.
- WAF / IP throttling beyond the in-memory rate limit — fold in once Cloudflare is in front of the prod domain.
