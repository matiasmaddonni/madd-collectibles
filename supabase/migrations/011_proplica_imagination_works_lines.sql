-- Add proplica + imagination-works as first-class product lines under
-- the Tamashii Nations brand and reassign existing 'otros' products
-- that belong to those lines.
--
-- Before: PROPLICA Nichirin swords + Imagination Works statues lived
-- under the catch-all 'otros' line. Storefront facets/categories
-- couldn't distinguish them from non-Tamashii leftovers.
--
-- After: each gets its own slug + brand, gradient styling, and category
-- card. Crawler overrides update accordingly (see
-- scripts/crawl/cache/tamashii-overrides.json).

with brand as (
  select id from public.brands where slug = 'tamashii-nations' limit 1
)
insert into public.product_lines (brand_id, slug, name, sort_order)
select brand.id, v.slug, v.name, v.sort_order
from brand, (values
  ('proplica',          'PROPLICA',          50),
  ('imagination-works', 'Imagination Works', 60)
) as v(slug, name, sort_order)
on conflict (slug) do nothing;

-- Reassign existing rows.
update public.products
   set product_line_id = (select id from public.product_lines where slug = 'proplica')
 where slug in ('nichirin-broken-rengoku', 'nichirin-tengen', 'nichirin-muichiro');

update public.products
   set product_line_id = (select id from public.product_lines where slug = 'imagination-works')
 where slug in ('iw-luffy', 'iw-vegeta', 'iw-son-goku');
