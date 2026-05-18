# Handoff: MADD. admin portal overhaul

## Overview

A complete refactor of the personal admin portal at `https://madd-collectibles.vercel.app/admin` (Matias' Saint Cloth Myth / S.H.Figuarts collectibles storefront). The current admin has four pain points the design solves:

1. **Dashboard** — currently just shows 4 counters + Recently added. Refactored into a dense, useful overview with metrics, a sales chart, stock breakdown, action items, and recent activity.
2. **Products** — currently a flat 256-row table with no search/filter/sort. Refactored with search, multi-filter, sortable columns, inline edits for the most-used actions, and pagination.
3. **Proposals** — currently a flat list that hides the structure of the AI-crawler proposals. Refactored into a master-detail layout with filters by source/confidence/status and keyboard navigation.
4. **Nav** — Brands / Lines / Series folded into a single **Settings** dropdown so the top-level nav only carries the three tabs that matter (Dashboard / Products / Proposals).

It's an internal tool for one user (Matias). No need to match the storefront's brand styling — function over form. Light **and** dark themes with a toggle in the header. Mobile is supported for status-change use cases (e.g. updating a product to `sold` from the phone).

## About the design files

The files in this bundle are **design references created in HTML/React** — a clickable prototype showing intended look and behavior, not production code to copy directly. The task is to **recreate these designs in the existing MADD codebase** (Next.js / React / Tailwind or whatever the storefront uses) following its established patterns: real data sources, real auth, real mutations to the database, real crawler integration for the proposals tab.

The prototype uses inline `<script type="text/babel">` blocks because it's a single self-contained HTML file. In production you'd:

- Split each tab into its own route/page (`/admin`, `/admin/products`, `/admin/proposals`, `/admin/settings`).
- Replace the mock data in `admin-data.jsx` with real queries against the backing data store.
- Replace local React state for status/price/condition changes with mutations that persist.
- Wire the dashboard's "jump to products with filters" handoff via URL query params (e.g. `/admin/products?missing=photos`) so links are shareable.
- Move the styles in `admin-styles.css` into whatever styling system the codebase already uses (Tailwind, CSS modules, etc.) — the CSS is plain, no preprocessor.

## Fidelity

**High-fidelity (hi-fi).** Pixel-perfect mockups with final colors, typography, spacing, interactions, and both light + dark themes. Recreate pixel-perfectly using the codebase's existing libraries. Every interaction state (hover, active, focus, approved, discarded, disabled) is in the prototype — match those.

## Screens / Views

### Screen 1 — Header (shared across all screens)

- **Layout**: 48px tall, sticky to top, full width. Three regions on a horizontal flex: brand (left, fixed), nav (center, flex: 1), header-right (right, fixed). 20px horizontal padding.
- **Brand**: `MADD` in 14px bold + `.` in 14px bold crimson `#C0392B` + `admin` in 12px medium grey. All on baseline alignment with 6px gap.
- **Nav items**: `Dashboard`, `Products`, `Proposals`, `Settings ▾`. Each is a button (transparent bg, no border, 6px 10px padding, 6px border radius). Hover: `--ah-neutral-bg` background. Active: same neutral-bg, full-strength text color, font-weight 500.
- **Proposals badge**: small red pill with white count (10px font, 600 weight, 1px×6px padding, 999px radius, min-width 16px). Shows the count of proposals with status `new`. Hide when 0.
- **Settings dropdown**: clicking opens an absolutely-positioned menu (top: 100% + 4px, left: 0, 180px min-width, surface bg, 1px border, 8px radius, shadow). Three items: `Brands`, `Lines`, `Series`, each with the entity count right-aligned in mono. Closes on outside click or item click.
- **Header-right**: theme toggle icon button (28×28, 1px border, 6px radius — sun icon when dark, moon icon when light), email (`matiasmaddonni@gmail.com`, 12px, muted), Sign out button (1px border, 6px radius).

### Screen 2 — Dashboard

Goal: a Matias-glances-at-this-daily view. Six tiles → chart → 2-col row (stock-by-line + needs-attention) → 2-col row (recent sold + reserved-by-age).

**Tiles row** (CSS grid, 6 columns, 10px gap):
- Total / Available / Reserved / Sold — 1 column each, mono numbers.
- **Inventory value** — spans 2 columns, shows `$<sum of USD prices for available items>`, sub-label "available only · USD".
- **Avg days in stock** — 1 column, sub-label "before sold". Calculated as the average of `(soldAt - createdAt)` in days across all `sold` products.

Each tile: white surface (`--ah-surface`), 1px border, 8px radius, 12px×14px padding. Label is uppercase 10.5px 600-weight muted with 0.5px tracking. Value is 24px 700-weight mono with -0.5px tracking. Sub-label is 11px muted mono.

**Sales chart card** (full-width):
- Card head: title "Sales over time", sub "Units sold per day · click a range". Right side: segmented control with 7d / 30d / 90d (default 30d). Segment is a pill (neutral bg, 2px padding) with active state (white surface + subtle shadow).
- Top of chart: two big stats — total sold in range (mono 22px) + approx revenue (mono 22px, calculated as `count × avg_price`). Labels below in 11px muted.
- SVG bar chart, 720×140 viewBox, `preserveAspectRatio="none"` so it fills the card width. Grid: dashed horizontal lines at 0 / max/2 / max. Axis labels: 9px mono at left + 4 evenly-spaced date labels along the bottom. Bars: `--ah-accent` blue, gap 2px, min-height 0.5px.

**Stock by line card** (1/2 width):
- Card head: title "Stock by line", sub "Available units only". Right: `<total> total` in mono muted.
- List of clickable rows. Each row: 140px label column + flex track column + 40px count column. Bar track is 8px tall, 4px radius, neutral bg; bar fill is accent blue at width proportional to `count / max_count`. Clicking a row jumps to **Products** with `?line=<slug>` filter applied.

**Needs attention card** (1/2 width):
- Card head: title "Needs attention", sub "Click to filter products".
- Each row: 10px severity dot (red high / amber med / grey low) + label + mono count + `→` arrow. Clicking jumps to Products with the corresponding filter.
- Rows: Missing photos (high) · Missing price drafts (high) · Missing description (med) · Reserved > 14 days (med, includes count of stale reservations) · Drafts ready to finish (low).

**Recently sold card** (1/2 width):
- List of last 5 items that flipped to `sold`. Each row: 28px thumb + name + line sub-label + `USD <price>` + relative time (`3d ago`).

**Reserved sorted by age card** (1/2 width):
- Same layout. Sort ascending by `reservedAt` (oldest first). Show `<N>d reserved` in amber if `> 14 days`, in muted otherwise.

### Screen 3 — Products

**Page title**: `Products (256)` — count is muted, in parentheses. Right side: `+ New Product` primary button (black bg, white text).

**Toolbar** (1px border, 8px radius, 8px×10px padding, surface bg, flex row with 8px gaps, flex-wrap):
- Search input — 220px min / 320px max width, 1px border 6px radius surface-2 bg, search icon + input + clear (×) button. Placeholder `Search by name…`. Filters update on every keystroke. Reset to page 0 on change.
- Four filter chips: Status / Line / Brand / Series. Each is a 1px-bordered 6px-radius pill containing a 11.5px muted label + a `<select>` with `All` as the first option. Active state (value selected): blue border + light blue bg + blue label color.
- `Clear (N)` ghost button appears when any filter or search is active. Resets all.
- Right side spacer pushes a `N results` mono muted count to the right.

**Table** (1px border, 8px radius, overflow hidden, white surface):
- Columns: 36px thumb / Name (sortable) / Line (sortable) / Series (sortable) / Price right-aligned (sortable) / Status (sortable) / Cond. (sortable) / Updated (sortable) / Actions 110px right-aligned.
- Header: surface-2 bg, 11px uppercase 600-weight muted, 0.4px tracking, 7px×10px padding, 1px bottom border. Sortable columns get a `↑` or `↓` arrow next to the label in accent blue when active. Click toggles direction.
- Rows: 5px×10px padding, 1px bottom border, hover gets surface-2 bg.
- **Thumb**: 24×24, 4px radius, diagonal-stripe placeholder background, 1px border. If product has no photo, show a 12px amber dot in the top-right corner with `!` in white 700-weight.
- **Name**: 12.5px, with a tiny amber `D` flag pill next to the name if `hasDesc === false && status !== 'draft'`.
- **Price**: mono. Click to inline-edit (becomes a number input with accent border, 80px wide). Enter or blur commits. Show `—` in amber if price is 0.
- **Status**: clickable colored chip ("status menu"). Click opens a dropdown with the four statuses (each with a colored dot). Selecting one updates the row.
- **Condition**: mono small. Click to swap for a `<select>` with the four conditions.
- **Updated**: relative time (`5d ago`, `2h ago`), muted mono.
- **Actions**: `↗` icon-link (opens on storefront) + `Edit` text-link.

**Pagination**: centered row at bottom — `← Prev` button (disabled at page 0), `Page N of M` mono muted, `Next →` (disabled at last page). Page size: 25 rows.

**Status chip colors** (light theme):
- `available` — bg `#dcfce7`, text `#166534`
- `reserved`  — bg `#fef3c7`, text `#92400e`
- `sold`      — bg `#e5e7eb`, text `#374151`
- `draft`     — bg `#fce7f3`, text `#9d174d`

Each chip: inline-flex, 2px×7px padding, 999px radius, 10.5px 600-weight uppercase, 0.3px tracking.

**Default sort**: `updated desc` (most recently updated first). Empty state when filters produce 0 results: centered text with a `Clear filters` link.

### Screen 4 — Proposals (master-detail)

**Page title**: `Proposals (<total>)`. Right meta: `Crawler · last run 47 min ago` + `Run crawler` ghost button.

**Layout**: CSS grid, 380px left column + 1fr right column. 1px border around the whole thing, 8px radius, overflow hidden, surface bg. Height calc'd to fill viewport below the page title (`calc(100vh - <header> - <padding> - <title>)`, min-height 600px).

**Left rail (list)**:
- Toolbar (10px padding, 1px bottom border, surface-2 bg):
  - Row 1: Filter tabs `All / New / In review`, each with a count pill. Active tab gets neutral-bg.
  - Row 2: Three mini-selects (1px border, 4px radius, surface bg): All sources / tamashii / ebay · Any confidence / ≥ 90% / 70–89% / < 70% · Sort: Newest / Oldest / Confidence ↓.
- Scrollable list of proposal cards:
  - Each card: full-width button, 10px×12px padding, 1px bottom border, 3px transparent left-border (becomes accent blue on active). Hover: neutral-bg. Active: accent-bg + accent left-border.
  - Card top row: product name (600-weight 13px) + `NEW` red tag pill if status is new.
  - Card mid: line name in 11px muted.
  - Card bot: mono small `<N> fields · <M> images` on left, relative time on right (e.g. `1d ago`).
  - Card foot: source pills (`tamashii`, `ebay`) — each is a 9.5px mono lowercase pill in neutral-bg — on left, confidence meter on right (40px track + percent label, colored by tier: green ≥90, amber 70–89, red <70).
- Foot: `↑↓ or j/k to navigate` 8px×12px padding, 1px top border, mono small muted.

**Keyboard nav**: `j` selects next item in the filtered list, `k` selects previous. Skip when focus is inside an input/textarea/select.

**Right pane (detail)**: scrollable, 20px×24px padding.

- **Detail head**: left = `NEW DRAFT` amber tag + line name muted small, then 20px 700-weight product title below. Right = `← Back` and `Edit product` ghost buttons.

- **Publish panel**: green-tinted (`--ah-ok-bg` background, `--ah-ok` border, 8px radius, 14px×16px padding). Contains:
  - Head row: "Publish to storefront" (600-weight 14px) + sub line ("Approve fields + images first…"). Right: green `Publish` button. Disabled (45% opacity, not-allowed cursor) until all fields are approved.
  - Checks row: 4 inline `✓` checks (Name set / At least one approved primary image / Price > 0 / Description set (recommended)). Each is muted by default, green when satisfied. The "recommended" one is italic.
  - Conditional yellow note: shown when not all fields are approved, lists pending counts.

- **Bulk actions row**: `Approve all fields` green-ghost button, `Discard all fields` ghost button, spacer, `Discard everything (fields + images)` red-ghost button.

- **Section head**: `Field proposals` h3 + muted summary like `1 approved · 0 discarded · 2 pending`.

- **Field cards** (one per proposed field, 8px gap):
  - 1px border 8px radius surface bg, 12px×14px padding.
  - Approved state: green border + green-tinted bg.
  - Discarded state: 50% opacity.
  - Head row: left = key tag (`DESCRIPTION` mono uppercase in neutral pill), source name in mono, confidence meter, `source ↗` link. Right = state tag (`APPROVED` green / `DISCARDED` grey) when set.
  - Diff: CSS grid 1fr 1fr, 10px gap. Each side has a 9.5px 700-weight uppercase label (`CURRENT` / `PROPOSED`) then a `<pre>` value block (11.5px mono, 8px×10px padding, 4px radius, surface-2 bg, 1px border, `white-space: pre-wrap`). The proposed side gets a green tint + green border.
  - Optional note row below diff (yellow bg, 4px radius, 6px×10px padding) — used for things like the eBay market range (`min $150 · median $195 · max $280 across 11 NEW listings`).
  - Actions row: green `Approve` button, ghost `Discard` button, ghost `Reset` button (only shown when state is not `pending`).

- **Image candidates**: section head `Image candidates` + `<N> found · click to approve` muted. Grid: `repeat(auto-fill, minmax(160px, 1fr))`, 10px gap.
  - Each image card: 1px border, 6px radius, surface-2 bg, overflow hidden.
  - Frame: 1:1 aspect ratio, diagonal-stripe placeholder, `img N` label centered.
  - Actions: 4px gap, 6px padding — `Approve` xs ghost-green button (turns into `✓ Primary` solid green when active), `Discard` xs ghost button.
  - Approved state: green border + 2px green-tint outer ring (box-shadow).
  - Discarded state: 40% opacity.

### Screen 5 — Settings

**Page title**: `Settings`. Sub-nav row below the title: three pill buttons (Brands / Lines / Series), each with a count pill on the right. Active sub-tab gets a solid black bg with white text; inactive get muted text + neutral hover bg. Default active: `brands`. Can be opened directly to a sub-tab via the header Settings dropdown (e.g. `settings:lines`).

Each sub-tab renders a `TaxonomyEditor` card:

- Card head: title (e.g. `Product lines`) + sub `<N> entries · inline edit, save per row`.
- **Add new row** section (below a horizontal divider): label `Add new <thing>`, then a flex row of named inputs (one per column) + black primary `Add` button at the end. For columns that reference another taxonomy (e.g. line's `brand`, series's `line`), use a `<select>` with the parent options instead of a text input.
- **Existing rows**: flex column of 1px-bordered 4px-radius surface-2 cards. Each row: per-column inline-edit fields (label + input/select), then right-side `Save` (blue link) + `Delete` (red link) actions.

Same pattern across all three taxonomies. The columns:
- **Brands**: `name`, `slug`.
- **Lines**: `name`, `slug`, `brand` (select).
- **Series**: `name`, `slug`, `line` (select).

## Interactions & Behavior

- **Tab navigation**: clicking a top-level nav item swaps the `<main>` content. No URL change in the prototype — in production, wire to routes.
- **Theme toggle**: writes `data-theme="light"|"dark"` on the `<html>` element. Persist in `localStorage` so it survives reload.
- **Dashboard → Products jump**: clicking a stock-by-line bar or a needs-attention row sets the products page's `initialFilters` prop. In production, pass via URL query string (e.g. `/admin/products?line=sh-figuarts`, `/admin/products?missing=photos`).
- **Products search**: debounced 0ms in prototype; safe to add 150ms debounce in production. Always resets to page 0.
- **Products sort**: clicking a column header toggles `desc` → `asc` on the same key; switches to a new key with `desc` default.
- **Inline price edit**: click → input appears with `autoFocus`. Commit on `Enter` or blur. Cancel on `Escape`.
- **Status menu**: click outside closes it (uses a `mousedown` listener on `document`).
- **Proposals keyboard**: `j` next, `k` prev. Skip when an input is focused.
- **Field approve/discard**: state is per-proposal, per-field, ephemeral in prototype. In production, persist immediately so leaving the page doesn't lose work.
- **Publish enable**: only when every field's state is `approved` (in production, you might also require an approved primary image).
- **Settings inline edit**: typing into a cell doesn't auto-save; the row's `Save` link commits. `Delete` deletes the row.

## Animations & transitions

Minimal — this is an admin tool. The only transitions present:
- Field card `opacity 0.15s` when toggling between states.
- Settings dropdown chevron `transform 0.15s` rotate when expanded.

Do not add unnecessary animations.

## State Management

In production (e.g. Next.js + React Query / SWR):

**Global / app state**:
- `theme` (light | dark) — persisted to localStorage.
- Current route — owned by the router.

**Server state** (fetched via queries):
- `products` — paginated, filterable.
- `proposals` — list + per-proposal detail.
- `brands`, `lines`, `series` — small lists, can be eager-loaded.
- `salesHistory` — for the dashboard chart. Likely a separate aggregate endpoint.
- `dashboardCounters` — could be one combined endpoint that returns all the dashboard tiles + lists in one shot.

**Mutations**:
- Update product status / price / condition (one PATCH endpoint with partial payload).
- Approve / discard a proposal field (POST to `/proposals/<id>/fields/<key>/approve|discard`).
- Approve / discard a proposal image.
- Publish a proposal's draft to live.
- Add / update / delete taxonomy entries (brands, lines, series).
- Trigger crawler run.

**Local UI state** (per-component):
- Search input value, active filters, current page, sort key/direction on Products.
- Source / confidence / sort / status filters on Proposals.
- Selected proposal id on Proposals.
- Inline-edit state (which cell is being edited, draft value).
- Open/closed state of dropdowns.

## Design Tokens

All defined in `admin-styles.css` under `:root` (light) and `[data-theme="dark"]`. Copy these verbatim into the codebase's design-token system or Tailwind config.

### Colors — Light

```
--ah-bg:           #f6f7f9   /* page background */
--ah-surface:      #ffffff   /* cards, table, header */
--ah-surface-2:    #fbfbfc   /* table header, inputs, secondary surfaces */
--ah-border:       #e3e5e8
--ah-border-2:     #ccd0d6
--ah-text:         #18191c
--ah-text-2:       #4a4d54
--ah-text-3:       #8a8d94   /* muted, sub-labels */
--ah-text-4:       #b4b7bd
--ah-accent:       #2563eb
--ah-accent-bg:    #e8efff
--ah-ok:           #15803d
--ah-ok-bg:        #dcfce7
--ah-warn:         #b45309
--ah-warn-bg:      #fef3c7
--ah-danger:       #b91c1c
--ah-danger-bg:    #fee2e2
--ah-neutral-bg:   #f1f3f5

/* Status chips — light */
--ah-chip-available:       #dcfce7   /* ink: #166534 */
--ah-chip-reserved:        #fef3c7   /* ink: #92400e */
--ah-chip-sold:            #e5e7eb   /* ink: #374151 */
--ah-chip-draft:           #fce7f3   /* ink: #9d174d */

/* Brand mark only — used in the wordmark dot */
--brand-crimson: #C0392B
```

### Colors — Dark

```
--ah-bg:           #0f1115
--ah-surface:      #14171c
--ah-surface-2:    #1a1d24
--ah-border:       #232830
--ah-border-2:     #313842
--ah-text:         #ecedef
--ah-text-2:       #b9bcc2
--ah-text-3:       #757a82
--ah-text-4:       #4d5159
--ah-accent:       #60a5fa
--ah-accent-bg:    rgba(96, 165, 250, 0.12)
--ah-ok:           #4ade80
--ah-ok-bg:        rgba(74, 222, 128, 0.12)
--ah-warn:         #fbbf24
--ah-warn-bg:      rgba(251, 191, 36, 0.12)
--ah-danger:       #f87171
--ah-danger-bg:    rgba(248, 113, 113, 0.12)
--ah-neutral-bg:   #1f242c

/* Status chips — dark */
--ah-chip-available:       rgba(74, 222, 128, 0.16)   /* ink: #4ade80 */
--ah-chip-reserved:        rgba(251, 191, 36, 0.16)   /* ink: #fbbf24 */
--ah-chip-sold:            rgba(255, 255, 255, 0.08)  /* ink: #b9bcc2 */
--ah-chip-draft:           rgba(244, 114, 182, 0.16)  /* ink: #f472b6 */
```

### Typography

- **Font family (body)**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif`. Use whatever the codebase uses; Inter is a good default if there's no existing choice.
- **Font family (mono)**: `'SF Mono', ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace`. Used for: all numbers, codes, slugs, timestamps, table values for price/condition/updated, count badges.
- **Base size**: 13px / 1.45 line-height.
- **Sizes used** (px): 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 20, 22, 24.
- **Weights used**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold).
- **Letter spacing**: `-0.5px` on h1 + chart stats; `0.3–0.5px` on uppercase labels.

### Spacing scale

The CSS uses ad-hoc values (4, 6, 8, 10, 12, 14, 16, 20, 24px). Map to your existing spacing scale where it lines up; round to the closest token when not. Don't introduce new sizes between these.

### Border radius

```
3px   small inline elements (mini tags, mini-flag)
4px   inputs, list rows, secondary cards
6px   buttons, search input, filter pills, segments
8px   cards, tables, panels
999px chips, badges
```

### Shadows

```
--ah-shadow-sm:  0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04)
--ah-shadow:     0 4px 12px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)
```

Dark theme inverts these (heavier blacks, lighter ring). Defined in tokens.

## Assets

No bitmap assets. All icons are inline SVG:
- Search icon (magnifying glass)
- Theme toggle (sun + moon)
- Chevron down (settings dropdown)
- Sort arrows (`↑` / `↓` Unicode)
- External link arrow (`↗` Unicode)
- Approve check (Unicode `✓`)

If the codebase has an icon library (Lucide, Heroicons, etc.) replace these with that library's equivalents at 14–16px.

The Brands / Lines / Series taxonomies use empty diagonal-stripe placeholders where product images would go. In production, fetch real thumbnails from the storefront's image store and render a 24×24 cropped square.

## Files in this bundle

- **`MADD admin.html`** — single self-contained prototype, loads React + Babel from unpkg and inlines all component scripts. Opening this in a browser gives you the full clickable experience.
- **`admin-styles.css`** — all CSS, including light + dark token definitions. ~600 lines, no preprocessor.
- **`admin-data.jsx`** — mock data: 256 products, 6 proposals, 90 days of sales history, brand/line/series taxonomies. Replace with real queries in production.
- **`admin-shell.jsx`** — header, primary nav, theme toggle, settings dropdown, shared helpers (`PageTitle`, `StatusChip`, `formatRelative`, `formatDate`).
- **`admin-dashboard.jsx`** — Dashboard view (tiles, chart, stock-by-line, needs-attention, recent sold, reserved-by-age).
- **`admin-products.jsx`** — Products view (toolbar, table, inline-edit cells, status menu, pagination).
- **`admin-proposals.jsx`** — Proposals master-detail (list, filters, detail with publish panel, field diff cards, image grid, keyboard nav).
- **`admin-settings.jsx`** — Settings sub-nav + `TaxonomyEditor` shared component.
- **`admin-app.jsx`** — Root: theme state, route state, dashboard→products filter handoff.

## Implementation order (recommended)

1. **Shell + theme** — header, nav, settings dropdown, light/dark toggle. Smallest scope, lays the design tokens.
2. **Settings (Brands / Lines / Series)** — simplest CRUD. Validates that mutations + persistence work end-to-end.
3. **Products** — biggest impact for Matias' daily use. Filters + search first, then sortable columns, then inline-edit, then status menu.
4. **Dashboard** — needs aggregate queries that may not exist yet. Get the tiles working, then add the chart (needs a daily-sales aggregate endpoint), then the action items (each is just a count + the existing filter handoff to Products).
5. **Proposals** — most complex, but volume is small (5–20 at a time per Matias). Build the list first with read-only filters, then the detail pane, then the approve/discard mutations, then the publish flow.

## Out of scope

- No bulk actions on Products (Matias edits one at a time).
- No CSV export.
- No user management / multi-user permissions — single user.
- No analytics beyond the sales chart.
- No proposal-comment thread (just approve/discard).
- No drag-and-drop reordering.
