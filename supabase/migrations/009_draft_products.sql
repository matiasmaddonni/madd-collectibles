-- ============================================================
-- 009 — Draft products
--
-- Allows the crawler to create new products in `draft` state so an
-- admin can fill them in via the proposal queue before they go live
-- on the storefront. Drafts are hidden from anon/authenticated reads
-- (storefront, sitemap, public REST) until status flips to a public
-- value ('available', 'reserved', 'sold').
--
-- Workflow:
--   1. Admin adds a slug → Tamashii item ID entry in the override file
--   2. Crawler sees the slug is not in `products`, inserts a row with
--      status='draft', placeholder price/condition, and Tamashii name.
--   3. Crawler then runs the normal proposal flow against the draft —
--      Tamashii spec + Fandom lede + eBay images all queue up.
--   4. Admin reviews proposals + sets price + flips status from
--      'draft' to 'available' on the standard /admin/products/<id>
--      edit page.
-- ============================================================

-- 1) Allow 'draft' on the status check constraint.
alter table public.products
  drop constraint if exists products_status_check;

alter table public.products
  add constraint products_status_check
  check (status in ('draft', 'available', 'reserved', 'sold'));

-- 2) RLS: keep the existing "public can read products" policy in place
-- but filter out drafts.
drop policy if exists "public can read products" on public.products;
create policy "public can read products"
  on public.products for select to anon, authenticated
  using (status <> 'draft');

-- 3) Refresh public_products view so it also hides drafts. Re-applies
-- the column list from migration 007 to keep cost_price stripped.
drop view if exists public.public_products;
create view public.public_products with (security_invoker = true) as
  select
    id,
    product_line_id,
    series_id,
    sku,
    name,
    slug,
    description,
    price,
    currency,
    condition,
    status,
    stock_qty,
    is_featured,
    release_year,
    tags,
    created_at,
    updated_at
  from public.products
  where status <> 'draft';

grant select on public.public_products to anon, authenticated;

-- 4) Index for the admin proposals filter (where status = 'draft').
create index if not exists products_draft_idx
  on public.products (status) where status = 'draft';
