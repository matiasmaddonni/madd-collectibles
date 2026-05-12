-- ============================================================
-- 007 — Force cost_price revoke
--
-- Migration 006 attempted `revoke select (cost_price) ... ` but
-- the table-wide `SELECT` grant already in place overrode it.
-- Postgres column-level privileges only restrict access when the
-- broader table-level privilege is removed first.
--
-- Strategy:
--   1. Revoke SELECT on the whole table from anon/authenticated.
--   2. Re-grant SELECT on every column EXCEPT cost_price.
--
-- After this migration, /rest/v1/products?select=cost_price returns
-- `permission denied for column cost_price` instead of null.
-- ============================================================

revoke select on table public.products from anon, authenticated;

grant select (
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
) on table public.products to anon, authenticated;

-- Refresh view grants too — `drop view ... ; create view ...` in 006
-- removed the SELECT grant on public_products.
grant select on public.public_products to anon, authenticated;
