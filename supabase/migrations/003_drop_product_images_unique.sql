-- product_images had unique(product_id) blocking multi-image per product.
-- Drop it. Multi-image per product is required (primary + alts).

alter table product_images drop constraint if exists product_images_product_id_unique;

-- Optional: enforce single primary per product instead.
create unique index if not exists product_images_one_primary_per_product
  on product_images (product_id)
  where is_primary;
