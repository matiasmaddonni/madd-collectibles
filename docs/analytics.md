# Analytics

Two backends, both first-party, no cookie banner needed.

| Backend | Always on? | Use |
|---|---|---|
| Vercel Web Analytics | Yes (production) | Pageviews + custom events |
| Meta (Facebook) Pixel | Only if `NEXT_PUBLIC_META_PIXEL_ID` is set | Ad attribution (Lead, InitiateCheckout) |

All event firing goes through [`lib/analytics.ts`](../lib/analytics.ts). Never call `track()` or `window.fbq` from components — use `trackEvent()` / `trackMetaEvent()` so types and event names stay centralized.

## Events

### `whatsapp_click_product`

Fires when the user clicks "Agregar al carrito" / "Ver carrito" on the product detail page (intent-to-buy on a single product).

| Prop | Type | Notes |
|---|---|---|
| `slug` | string | Product URL slug |
| `productName` | string | Display name |
| `price` | number | Item price |
| `currency` | `"USD" \| "ARS"` | Item currency |
| `line` | string | Product line name (e.g. "S.H.Figuarts") |

**Fired in:** [`app/products/[slug]/ProductDetailCTA.tsx`](../app/products/%5Bslug%5D/ProductDetailCTA.tsx) — `onClick`.

**Meta Pixel mapping:** `Lead` with `{ content_ids: [slug], content_type: "product", value: price, currency }`.

### `whatsapp_click_cart`

Fires when the user clicks "Finalizar compra" in the cart drawer (full-cart conversion).

| Prop | Type | Notes |
|---|---|---|
| `itemCount` | number | Sum of `qty` across cart |
| `totalUSD` | number | USD-priced items only (ARS-priced not converted) |
| `slugs` | `string[]` | Product ids (used as slug surrogates) |

**Fired in:** [`components/cart/CartDrawer.tsx`](../components/cart/CartDrawer.tsx) — `onCheckout`, before `recordCheckoutIntent` and `window.open(waLink)`.

**Meta Pixel mapping:** `InitiateCheckout` with `{ content_ids, content_type: "product", value: totalUSD, currency: "USD", num_items: itemCount }`.

### `share_click`

Fires after the share action succeeds (native share completed OR clipboard copy completed).

| Prop | Type | Notes |
|---|---|---|
| `slug` | string | Product URL slug |
| `productName` | string | Display name |
| `method` | `"native" \| "copy"` | Which path actually fired |

**Fired in:** [`components/product/ShareButton.tsx`](../components/product/ShareButton.tsx) — fires once per successful share, after `navigator.share()` resolves OR after `navigator.clipboard.writeText()` resolves. Aborted shares (user cancelled the OS sheet) don't fire.

### `catalog_filter_apply`

Fires when the user applies catalog filters. Debounced 500ms — rapid toggles coalesce into one event.

| Prop | Type | Notes |
|---|---|---|
| `line` | `string?` | CSV of line slugs from `?linea=` |
| `series` | `string?` | CSV of series slugs from `?serie=` |
| `availability` | `string?` | CSV of condition slugs from `?condicion=` |

No-op when all three are empty (avoids firing on `?orden=` or `?pagina=` only changes).

**Fired in:** [`app/catalogo/CatalogClient.tsx`](../app/catalogo/CatalogClient.tsx) — inside `CatalogPendingProvider`'s effect on `useSearchParams()` change, after a 500ms debounce.

## Verification

### Vercel Analytics

1. Deploy to production (events don't ship from `localhost` by default).
2. Vercel Dashboard → project → **Analytics** tab → **Events** subtab.
3. Trigger each event from the live site. Events appear within ~1 minute.
4. Filter by event name to see prop breakdowns.

For local dev: events log to the browser console (`[analytics] <name> <props>`) when `NODE_ENV === "development"`. They don't ship to Vercel.

### Meta Pixel (when enabled)

1. Set `NEXT_PUBLIC_META_PIXEL_ID=<your-id>` in Vercel project env vars (Production + Preview).
2. Redeploy.
3. Install [Meta Pixel Helper](https://chromewebstore.google.com/detail/meta-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc) Chrome extension.
4. Visit live site → extension shows green check + `PageView` event.
5. Click "Agregar al carrito" → extension shows `Lead`.
6. Click "Finalizar compra" → extension shows `InitiateCheckout`.
7. Cross-check in Meta Events Manager → Test Events tab.

## Enabling Meta Pixel later

When ready to start paid ads:

1. Create the Pixel in Meta Events Manager (`https://business.facebook.com/events_manager`).
2. Copy the 15–16 digit Pixel ID.
3. Add to Vercel env vars: `NEXT_PUBLIC_META_PIXEL_ID=<id>` for Production + Preview.
4. Redeploy. The `<Script>` injection in [`app/layout.tsx`](../app/layout.tsx) now fires automatically.
5. No code changes needed — `trackMetaEvent()` already calls `fbq('track', ...)` inside the WhatsApp click handlers; it no-ops while `fbq` is undefined.

## What we're not tracking

By design, the following are **not** instrumented:
- Google Analytics (using Vercel Analytics instead)
- Cookie consent banner (Vercel Analytics is cookie-less; Meta Pixel will need one before launching to EU traffic — Argentina doesn't require)
- Scroll depth, time on page, rage clicks
- Session replay (Hotjar / FullStory / etc.)

Add these only with explicit product reasoning, not by default.
