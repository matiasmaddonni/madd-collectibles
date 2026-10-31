-- Collapse product condition to three buyer-facing tiers:
--   mint_sealed -> "Nuevo"             sealed, never opened
--   mint_open   -> "Usado como nuevo"  opened, figure and box near mint
--   fair        -> "Usado detalles"    broken or missing part, or a box in
--                                      bad shape
-- near_mint (shown as "Loose") and good (shown as "Used") are retired.
-- Their rows were reviewed one by one on 2026-10-31; anything not flagged
-- with a flaw lands in mint_open.
--
-- Apply BEFORE deploying the matching code: the new code only knows the
-- three tiers above. Idempotent: re-running is a no-op.

-- 1) Flawed items -> fair.
update public.products
set condition = 'fair'
where condition in ('near_mint', 'good')
  and (
    slug in (
      'figzero-guts-black-swordsman',             -- broken hand
      'myth-cloth-ex-war-god-ares',               -- broken hand
      'myth-cloth-10th-anniversary-display-stage',-- dented box, may miss parts
      'yuji-itadori-fz',                          -- dented box
      'bundle-gold-saints-soul-of-gold',          -- Loki has broken parts
      'great-ape-vegeta',                         -- Yajirobe broken
      'iron-man-tech-on-avengers',                -- may miss parts
      'aries-mu-oce',                             -- box in bad shape
      'aokiji-kuzan',                             -- box damaged
      'chopper',
      'nami',
      'robin',
      'sanji'
    )
    -- Some Pop Up Parade boxes are in bad shape; flag the whole batch.
    or slug like 'pop-up-parade-%'
  );

-- 2) Everything else still on a retired tier -> mint_open.
update public.products
set condition = 'mint_open'
where condition in ('near_mint', 'good');

-- 3) Tighten the check constraint.
alter table public.products
  drop constraint if exists products_condition_check;

alter table public.products
  add constraint products_condition_check
  check (condition in ('mint_sealed', 'mint_open', 'fair'));
