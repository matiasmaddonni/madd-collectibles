-- ============================================================
-- 010 — Series go global (line-agnostic)
--
-- Up to now `series.product_line_id` was NOT NULL, which forced the
-- same franchise (e.g. "Saint Seiya", "Dragon Ball Z") to live as
-- separate rows under each product line that carried products from
-- that franchise. That surfaced as duplicate facet entries on the
-- storefront (Saint Seiya 11 / Saint Seiya 1, Demon Slayer 9 / 1).
--
-- This migration:
--   1. Drops NOT NULL on `series.product_line_id` so a single series
--      row can represent the franchise globally.
--   2. Leaves the FK in place (still references product_lines on
--      delete restrict) for backwards compatibility — existing rows
--      keep their line reference; new rows can be NULL.
--
-- A separate one-off script (scripts/merge-series.ts) deduplicates
-- existing rows by name + repoints products.series_id to the canonical
-- row before deleting the others.
-- ============================================================

alter table public.series
  alter column product_line_id drop not null;
