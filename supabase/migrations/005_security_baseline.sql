-- ============================================================
-- Security baseline: idempotent re-assertion of RLS on every
-- application table. Safe to re-run; intentionally no-ops if RLS
-- is already enabled and policies already exist.
-- ============================================================

-- Re-assert RLS on every public table that holds storefront or PII data.
-- Anon writes are blocked everywhere — only the service role (used by
-- server actions / admin scripts) can mutate these tables.
alter table brands           enable row level security;
alter table product_lines    enable row level security;
alter table series           enable row level security;
alter table products         enable row level security;
alter table product_images   enable row level security;
alter table checkout_intents enable row level security;

-- ============================================================
-- Reminder for future migrations
-- ============================================================
-- When adding a new table holding any user-exposed data:
--   1. enable row level security
--   2. add SELECT policy to `anon, authenticated` only if it must be
--      readable from the browser
--   3. NEVER add INSERT / UPDATE / DELETE policies for `anon` — writes
--      go through server actions running with the service role
--   4. confirm cost / margin / private fields are excluded via a SECURITY
--      INVOKER view (see `public_products` for the pattern)
