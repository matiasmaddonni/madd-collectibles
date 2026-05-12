-- ============================================================
-- 006 — Security hardening
--
-- 1. Revoke SELECT on cost_price from anon/authenticated. RLS in
--    Postgres is row-level, not column-level, so an attacker with
--    the anon key can call /rest/v1/products?select=cost_price
--    directly. Column-level GRANT closes that hole.
-- 2. Atomic RPC for adding a product image — clears existing
--    primary flags and picks the next sort_order in a single
--    transaction, eliminating the sort_order race + the
--    "no primary image" window from non-atomic UPDATE+INSERT.
-- 3. set_primary_product_image RPC — same idea for promoting
--    an existing image to primary.
-- 4. Rate-limit hit table + RPC for serverless-safe rate
--    limiting. In-process Maps don't share state across Vercel
--    function instances; this stores hits in Postgres.
-- ============================================================

-- 1) Revoke cost_price from public roles.
revoke select (cost_price) on table products from anon, authenticated;

-- Refresh public_products view to include `currency` (originally omitted) so
-- the storefront can switch to the view in future without losing currency
-- display. Keeps cost_price excluded.
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
  from public.products;

-- Re-grant explicit columns the storefront actually needs. (Optional
-- belt-and-suspenders; Supabase typically uses column-blind grants, but
-- being explicit here means a future ALTER TABLE … ADD COLUMN doesn't
-- silently expose a new private field.)
grant select (
  id, slug, name, sku, product_line_id, series_id, price, currency,
  condition, status, stock_qty, is_featured, release_year,
  description, tags, created_at, updated_at
) on table products to anon, authenticated;

-- ============================================================
-- 2) add_product_image: atomic add + primary swap + sort_order.
-- ============================================================
create or replace function public.add_product_image(
  p_product_id uuid,
  p_url text,
  p_is_primary boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_sort int;
  v_image_id uuid;
begin
  if p_is_primary then
    update product_images
       set is_primary = false
     where product_id = p_product_id
       and is_primary = true;
  end if;

  select coalesce(max(sort_order) + 1, 0)
    into v_next_sort
    from product_images
   where product_id = p_product_id;

  insert into product_images (product_id, url, is_primary, sort_order)
  values (p_product_id, p_url, p_is_primary, v_next_sort)
  returning id into v_image_id;

  return v_image_id;
end;
$$;

revoke all on function public.add_product_image(uuid, text, boolean) from public;
grant execute on function public.add_product_image(uuid, text, boolean) to service_role;

-- ============================================================
-- 3) set_primary_product_image: atomic primary swap.
-- ============================================================
create or replace function public.set_primary_product_image(
  p_product_id uuid,
  p_image_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update product_images
     set is_primary = (id = p_image_id)
   where product_id = p_product_id;
end;
$$;

revoke all on function public.set_primary_product_image(uuid, uuid) from public;
grant execute on function public.set_primary_product_image(uuid, uuid) to service_role;

-- ============================================================
-- 4) Rate-limit storage + RPC.
-- ============================================================
create table if not exists public.rate_limit_hits (
  bucket    text         not null,
  key       text         not null,
  hit_at    timestamptz  not null default now()
);

create index if not exists rate_limit_hits_lookup_idx
  on public.rate_limit_hits (bucket, key, hit_at desc);

alter table public.rate_limit_hits enable row level security;
-- No policies = only service role can read/write.

-- Returns true if the call is allowed, false if rate limited.
-- Caller passes the bucket name (e.g. 'checkout_intent'), the dedupe key
-- (e.g. IP), the window in seconds, and the max hits per window.
create or replace function public.rate_limit_check(
  p_bucket text,
  p_key text,
  p_window_seconds int,
  p_max int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Garbage-collect old rows occasionally so the table doesn't grow forever.
  -- Cheap probabilistic GC — runs ~1% of calls.
  if random() < 0.01 then
    delete from rate_limit_hits
     where hit_at < now() - interval '1 day';
  end if;

  select count(*)
    into v_count
    from rate_limit_hits
   where bucket = p_bucket
     and key   = p_key
     and hit_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    return false;
  end if;

  insert into rate_limit_hits (bucket, key) values (p_bucket, p_key);
  return true;
end;
$$;

revoke all on function public.rate_limit_check(text, text, int, int) from public;
grant execute on function public.rate_limit_check(text, text, int, int) to service_role;
