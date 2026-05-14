-- Fix set_primary_product_image: 23505 unique_violation when promoting
-- an image to primary.
--
-- The previous body did the swap in ONE statement:
--   update product_images set is_primary = (id = p_image_id)
--    where product_id = p_product_id;
--
-- The partial unique index `product_images_one_primary_per_product`
-- (one is_primary=true row per product, from migration 003) is checked
-- per-row as the UPDATE proceeds — it is NOT deferred. When Postgres
-- happens to update the new-primary row before clearing the old one,
-- two rows transiently hold is_primary=true and the statement aborts
-- with 23505. Whether it errors is row-order dependent, which is why it
-- only failed for some products.
--
-- Fix: clear the existing primary first, then set the new one — two
-- statements, never more than one is_primary=true at any point. Mirrors
-- the approach already used in add_product_image.

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
  -- Step 1: demote whatever is currently primary (except the target,
  -- so a no-op re-promote of the existing primary still works).
  update product_images
     set is_primary = false
   where product_id = p_product_id
     and is_primary = true
     and id <> p_image_id;

  -- Step 2: promote the target. Scoped by product_id as a guard so a
  -- mismatched (product, image) pair touches nothing.
  update product_images
     set is_primary = true
   where id = p_image_id
     and product_id = p_product_id;
end;
$$;

revoke all on function public.set_primary_product_image(uuid, uuid) from public;
grant execute on function public.set_primary_product_image(uuid, uuid) to service_role;
