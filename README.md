# MADD. — Coleccionables Bandai en Argentina

Personal collectibles storefront. Single owner (matiasmaddonni@gmail.com),
single curator, single language (Spanish, `es-AR`). Sells Saint Cloth
Myth EX, S.H.Figuarts, Figuarts Zero, Pop Up Parade, Robo-Dou and other
Bandai / Tamashii / Three Zero figures.

Live: <https://madd-collectibles.vercel.app>

## What this site does

- **Storefront** — public catalog at `/catalogo` with filters
  (línea, serie, condición, precio, disponibilidad), per-product detail
  pages with image gallery + JSON-LD structured data, and a shopping
  cart that hands off to WhatsApp for checkout.
- **WhatsApp checkout** — no payment processor on the site. The cart
  serialises the order into a WhatsApp deep-link to the owner's number,
  fires a Resend email with the verified order summary, and the
  conversation closes through chat. Server-recomputes every price from
  the products table before persisting so the email can't be tampered.
- **Admin portal** at `/admin` — single-user dashboard for inventory
  management, product CRUD, image uploads, status flips, taxonomy
  editing, and a crawl-proposals review queue. Light + dark themes,
  mobile-friendly for status flips.
- **Crawler** at `npm run crawl[:apply]` — CLI tool that pulls
  description / SKU / release year / gallery photos from official
  sources (Tamashii Web, Good Smile Company, MegaHouse, Three Zero,
  Fandom wikis, eBay) and stages them as proposals in the admin review
  UI. New product slugs in the override file become draft products
  automatically.

## Tech stack

| Layer | Pick | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) | RSC for fast SSR pages, server actions for mutations, file-system routing |
| UI runtime | **React 19** | Latest stable, matches Next 16 |
| Styling | **Tailwind CSS v4** | CSS-first config via `@theme inline` in `app/globals.css`. No `tailwind.config.ts`. Storefront uses a single dark crimson palette; admin has its own `--ah-*` token set in `app/admin/admin.css` |
| Icons | **lucide-react** | Storefront uses inline SVG, admin uses lucide |
| Data layer | **Supabase Postgres** via `@supabase/supabase-js` + `@supabase/ssr` | No ORM — declarative PostgREST `.select()` chains keep query shape obvious. RLS does the heavy lifting for public read security |
| Auth | **Supabase Auth** (email + password) | Single admin allowlist via `ADMIN_EMAILS` env var; `proxy.ts` redirects non-admins away from `/admin/*` |
| Storage | **Supabase Storage** buckets `product-images`, `category-images` | Public-read, service-role-write. Magic-byte sniff on uploads |
| Email | **Resend** | Single transactional path — checkout notifications to the owner. Optional in dev (skipped when `RESEND_API_KEY` unset) |
| Analytics | **Vercel Analytics** + **Meta Pixel** | First-party usage stats + Meta Lead / AddToCart events |
| Currency | **dolarapi.com** USD-blue rate | Server-side fetch, 1h revalidated, with `NEXT_PUBLIC_USD_TO_ARS` override + fallback. Dashboard normalises ARS to USD for inventory + revenue totals |
| Deploy | **Vercel** | Next-native, edge runtime for `proxy.ts` (CSP nonce) and the OG image |
| Crawler | **tsx + cheerio** | Pure Node CLI under `scripts/crawl/` (not bundled in the Next app) |

## Architecture decisions

### No ORM
Supabase's PostgREST client is verbose but transparent. Migrations are raw
SQL in `supabase/migrations/`. Schema lives in the DB; types are derived
inline. Trade-off accepted: less compile-time safety, more direct control
over the wire shape.

### RLS as the security boundary
Anon role can read `products WHERE status <> 'draft'` and join taxonomy
tables. No `INSERT/UPDATE/DELETE` policies for anon or authenticated;
every write goes through a server action that runs under the service
role after `requireAdmin()`. Column-level revoke on `products.cost_price`
keeps the wholesale price out of public responses. See migrations
`005_security_baseline.sql` and `007_cost_price_revoke_fix.sql`.

### CSP nonce per request
`proxy.ts` generates a fresh nonce on every request, forwards it via
the `x-nonce` request header, and emits a strict-dynamic CSP. Inline
scripts (Meta Pixel, JSON-LD, admin ThemeBootstrap) read it via
`headers()` and pass it as `nonce={nonce}` on `<script>` tags so they
survive strict-dynamic. Falls back gracefully on legacy browsers.

### Storefront vs admin token systems
The storefront keeps a single dark crimson palette
(`--color-bg-*`, `--color-accent`) tuned for product photos. The admin
portal has its own `--ah-*` design tokens (light + dark) scoped under
`:root[data-theme="..."] .admin-root` so the two never bleed into each
other. The admin layout swaps the body bg via `body:has(.admin-root)`.

### Sold/reserved timestamps
`products` has `sold_at` and `reserved_at` columns maintained by a
`BEFORE INSERT OR UPDATE` trigger (`013_product_status_timestamps.sql`).
Powers the dashboard's recent-sold, reserved-by-age, and sales-over-time
chart without relying on `updated_at` as a proxy.

### Crawler as draft-creator
Override files (`scripts/crawl/cache/*-overrides.json`) map storefront
slugs to source pages. When a slug doesn't exist in `products` and the
override declares a `line`, the runner inserts a `status='draft'` row
before the proposal loop runs. Drafts are RLS-hidden from anon and only
visible in `/admin` until the owner publishes them.

### WhatsApp instead of a payment processor
Argentina-specific: most figure sales happen through DM. The
WhatsApp deep-link checkout pre-fills a structured message the owner
can review and confirm by hand. The `recordCheckoutIntent` server
action also writes a `checkout_intents` row + emails the owner a
copy. Server-recomputes price + currency from the products table on
every intent — the client cart is opaque.

## Project layout

```
app/
  page.tsx                       # Home (Hero, Categorías, Featured, etc.)
  catalogo/                      # Product grid with filters + pagination
  products/[slug]/               # Per-product detail + WhatsApp CTA
  checkout/actions.ts            # recordCheckoutIntent server action
  admin/                         # Admin portal — see admin section below
    layout.tsx                   # Auth gate + shell
    admin.css                    # --ah-* tokens (light + dark)
    page.tsx                     # Dashboard (tiles + chart + insights)
    products/                    # List + edit form + inline editors
    proposals/                   # Crawl proposals master-detail
    settings/                    # Brands / Lines / Series taxonomy CRUD
  opengraph-image.tsx            # Site-wide OG image (Next ImageResponse)
  layout.tsx                     # Root html / body + Organization JSON-LD
  globals.css                    # Storefront tokens (Tailwind v4 @theme)
components/
  layout/                        # Navbar, Footer, MobileMenu, search
  home/                          # Hero, CategoryGrid, FeaturedProducts, Opiniones, AboutMadd
  catalog/                       # ProductCard, CardImageCarousel
  cart/                          # CartProvider, CartDrawer, AddToCartButton
  product/                       # ShareButton
lib/
  env.ts                         # Validated env vars (throws if missing)
  auth.ts                        # requireAdmin / isAdminEmail
  supabase/{server,admin,public}.ts
  queries.ts                     # All read queries (server-side)
  storage.ts                     # urlToStoragePath helper
  currency.ts                    # USD↔ARS conversion (dolarapi)
  format.ts                      # Locale-aware Intl.NumberFormat
  email.ts                       # Resend client
  contact.ts                     # waLink helper
  analytics.ts                   # Vercel + Meta event wrappers
  opiniones.ts                   # Hand-curated testimonials data
proxy.ts                         # CSP nonce + admin auth redirect
scripts/
  crawl.ts                       # Crawler entry point
  crawl/                         # Adapters (tamashii, goodsmile, megahouse, threezero, fandom, ebay) + runner
  *.ts                           # Various one-shot maintenance scripts
supabase/migrations/             # SQL migrations (idempotent, re-runnable)
public/                          # Static assets (logo, favicon, og image fallbacks)
```

## Local dev

```bash
# 1. Install
npm install

# 2. Env vars — see "Environment variables" below
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS (your email)

# 3. Dev server
npm run dev

# 4. Sign in at /admin/login with an email listed in ADMIN_EMAILS

# 5. Optional: run the crawler against your DB
npm run crawl              # dry-run (logs what would be proposed)
npm run crawl:apply        # actually writes proposals + uploads images
npm run crawl:apply -- --source=threezero --batch=evangelion
```

Useful scripts:

```bash
npm run dev          # Next dev server
npm run build        # Production build (verifies types + lint pass)
npm run start        # Run the production build locally
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run crawl        # Dry-run crawler
npm run crawl:apply  # Live crawler (writes to DB + Storage)
```

## Environment variables

Required in **production** (set in Vercel → Project Settings →
Environment Variables → Production):

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL — throws on boot if missing |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for SSR + client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only — admin client, server actions, crawler |
| `ADMIN_EMAILS` | Comma-separated allowlist for `/admin/*` access |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL — sitemap, robots, OG, WhatsApp links |
| `NEXT_PUBLIC_WA_NUMBER` | WhatsApp number (e.g. `5491198765432`) for checkout deep-links |

Optional but recommended:

| Var | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend transactional email — order notifications |
| `CHECKOUT_NOTIFY_EMAIL` | Destination for order emails (**required if `RESEND_API_KEY` is set** — throws at boot otherwise) |
| `RESEND_FROM` | From address; defaults to `MADD <onboarding@resend.dev>` |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta Pixel ID (only loaded if numeric 6–32 digits) |
| `NEXT_PUBLIC_USD_TO_ARS` | Static rate override; otherwise dolarapi.com + 1300 fallback |
| `EBAY_APP_ID`, `EBAY_CERT_ID` | eBay Buy API credentials (crawler-only, optional) |

## Database

Migrations in `supabase/migrations/` are vanilla SQL, prefixed by
sequence number. Apply via the Supabase dashboard SQL editor or
`supabase db push` if you've wired the CLI. All migrations are
idempotent.

Tables:

- `products` — main inventory. Status enum: `draft / available / reserved / sold`. Auto-maintained `sold_at` / `reserved_at` timestamps.
- `brands` → `product_lines` → `series` — three-tier taxonomy.
- `product_images` — bucket-relative paths; `is_primary` flag; `proposed_by_source` marks crawler-staged candidates pending admin review.
- `crawl_proposals` — per-field staging rows from the crawler; admin approves or rejects each in `/admin/proposals`.
- `checkout_intents` — audit trail for WhatsApp order intents (server-computed totals).
- `rate_limit_hits` — token-bucket rate limiter table, garbage-collected.

## Admin portal

`/admin` (auth required). Sections:

- **Dashboard** — six tiles (total / available / reserved / sold / inventory value in USD / avg days), a 30-day sales bar chart, stock-by-line bars colored by share of total, "Needs attention" actions (missing photos / price / description, stale reservations, drafts ready to publish), recently sold, reserved by age.
- **Products** — URL-driven filters (`q, status, line, brand, series, missing, sort, dir, page`), sortable columns, inline edits (price / status / condition), bulk thumbnail loading, 25/page.
- **Proposals** — master-detail layout, sticky selection across mutations, per-field diff cards with approve / discard, image candidates sorted tamashii → goodsmile → megahouse → fandom → ebay, publish-to-storefront flow for drafts.
- **Settings** — Brands / Lines / Series CRUD with sub-nav.

Theme toggle persists to `localStorage.adminTheme`, falls back to
OS preference on first load. Mobile-optimised for status flips on the
Products tab.

## Crawler

CLI tool, never invoked at runtime. Each adapter (`scripts/crawl/sources/*.ts`)
maps storefront slugs to a source URL via a JSON override file in
`scripts/crawl/cache/`. The runner pulls structured data (description,
release year, SKU, gallery images) and stages a per-field proposal +
image candidate row in the DB. Admin reviews everything before it goes
public.

Override formats:

```jsonc
// scripts/crawl/cache/tamashii-overrides.json — string OR object
"overrides": {
  // existing product, just propose new data
  "ushio": "13745",

  // new product, runner creates a draft row first
  "wyvern-rhadamanthys": {
    "id": "384",
    "line": "myth-cloth",   // required for draft creation — must match product_lines.slug
    "name": "Wyvern Rhadamanthys"  // optional, falls back to scraped title
  }
}
```

Sources today:

- **Tamashii Web** — Bandai official store. Highest-confidence source for Saint Cloth Myth, Figuarts Zero, Proplica, Imagination Works. Legacy listings (pre-2015) use a slightly different image URL shape; both are handled.
- **Good Smile Company** — official storefront for Pop Up Parade and Nendoroid releases.
- **MegaHouse (en.megahobby.jp)** — Shopify store; adapter reads the `.json` endpoint per product.
- **Three Zero (threezerohk.com)** — FigZero + Robo-Dou figures. Parses JSON-LD Product blocks; falls back to `og:` meta tags + a gallery sweep.
- **Fandom wikis** — character description fallback when official sources are sparse. Series-keyed so Chainsaw Man queries don't leak into the Dragon Ball wiki.
- **eBay Buy API** — market-rate price reference (median of recent sold listings) for the admin's pricing decision; never auto-applied to the product.

Polite request timing (800 ms per host) and 3-retry exponential
backoff are wired in `scripts/crawl/http.ts`. Run with `--dry-run`
(default) until you're sure of the output.

## Security posture

- **RLS** drops drafts and `cost_price` from public reads. All writes service-role only.
- **Per-request CSP nonce** via `proxy.ts` + `strict-dynamic`.
- **Rate limiting** — `rate_limit_check` Postgres RPC. Two buckets on the admin sign-in (per-IP + per-email), one on checkout intents. Fails closed on RPC error.
- **Image uploads** — admin-only path with magic-byte signature check (defeats lying mime headers).
- **Checkout server-recompute** — client-supplied prices ignored; the server re-derives from the products table before persisting / emailing the intent.
- **`X-Robots-Tag: noindex, nofollow, noarchive`** on every `/admin/*` and `/checkout/*` response (belt-and-suspenders alongside robots.txt).
- **No third-party JS in production** except Vercel Analytics + Meta Pixel (both nonce-threaded under strict-dynamic).

## Tooling

- **Linting** — `npm run lint` runs ESLint with `eslint-config-next`. `design_handoff_admin_overhaul/` is ignored.
- **Types** — `npm run typecheck` (`tsc --noEmit`). Build also enforces types.
- **No tests today** — single-user shop. Adding Playwright for the checkout flow would be the highest-value first test if scope ever changes.

## Deploy

Push to `main` → Vercel auto-deploys.

After every Supabase schema change, apply the migration in the dashboard
*before* the corresponding code rolls out, or the new code will run
against the old schema and fail.

## License

Personal project, all rights reserved. The crawler adapters scrape
publicly available product info; respect each source's TOS if you
fork this for your own shop.
