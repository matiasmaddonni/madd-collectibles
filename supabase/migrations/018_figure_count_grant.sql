-- Migration 006 pinned column-level SELECT grants on `products` to the
-- exact storefront-facing columns, so adding `figure_count` in 017
-- left it ungranted for anon / authenticated. The home-page count
-- query (`SELECT product_line_id, figure_count …` via the public
-- supabase client) silently fails the whole row, which is why every
-- category card collapsed to 0 figuras after deploy.
--
-- Add the missing grant. RLS already restricts visible rows.

grant select (figure_count) on table public.products
  to anon, authenticated;
