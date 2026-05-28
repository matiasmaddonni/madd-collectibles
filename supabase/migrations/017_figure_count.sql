-- Path A bundles: a single product row can represent a batch of figures
-- (e.g. "Twelve Gold Saints"). We don't model the individual figures as
-- their own rows; instead the bundle row carries a `figure_count` so
-- the dashboard can still report "you own N figures total" even when
-- most rows are bundles.
--
-- NULL means singleton — aggregates should treat NULL as 1.
-- The check constraint blocks 0 / negative values; the high bound is
-- only there to catch typos like 999999.

alter table public.products
  add column figure_count smallint
  check (figure_count is null or (figure_count >= 1 and figure_count <= 999));

comment on column public.products.figure_count is
  'For bundle products: number of individual figures the row represents. NULL = singleton (count as 1). Used by dashboard ''Total figures owned''.';
