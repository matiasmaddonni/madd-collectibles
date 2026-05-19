-- Seed taxonomy for the Three Zero brand so the threezero crawler
-- (scripts/crawl/sources/threezero.ts) can create draft products that
-- reference the lines + series by slug.
--
-- Idempotent: rerunnable. Uses unique slug to skip on conflict.

INSERT INTO public.brands (slug, name, sort_order)
VALUES ('three-zero', 'Three Zero', 0)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.product_lines (slug, name, brand_id, sort_order)
SELECT 'figzero', 'FigZero', b.id, 0
FROM public.brands b
WHERE b.slug = 'three-zero'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.product_lines (slug, name, brand_id, sort_order)
SELECT 'robo-dou', 'Robo-Dou', b.id, 0
FROM public.brands b
WHERE b.slug = 'three-zero'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.series (slug, name, product_line_id, sort_order)
SELECT 'evangelion', 'Evangelion', l.id, 0
FROM public.product_lines l
WHERE l.slug = 'robo-dou'
ON CONFLICT (slug) DO NOTHING;
