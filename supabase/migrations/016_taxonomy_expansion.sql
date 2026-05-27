-- Catalog expansion (May 2026): adds Sentinel as a new brand, eight new
-- product lines across the existing + new brand, seven new series, and
-- 17 draft products for sources that the crawler doesn't auto-stage
-- (goodsmile + megahouse + manual-fill Sentinel/MFC).
--
-- Drafts for Tamashii Web + Three Zero items are NOT created here --
-- their respective override files support object-form draft creation
-- via the crawler runner, so adding them to the override JSON is enough.
--
-- Idempotent: every INSERT uses ON CONFLICT DO NOTHING so reruns are safe.

-- ---------- 1. Brands ----------

INSERT INTO public.brands (slug, name, sort_order) VALUES
  ('sentinel', 'Sentinel', 50)
ON CONFLICT (slug) DO NOTHING;

-- ---------- 2. Product lines ----------

-- Tamashii Nations sub-lines
INSERT INTO public.product_lines (slug, name, brand_id, sort_order)
SELECT 'figuarts-mini', 'Figuarts Mini', b.id, 80
FROM public.brands b WHERE b.slug = 'tamashii-nations'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.product_lines (slug, name, brand_id, sort_order)
SELECT 'metal-robot', 'METAL ROBOT', b.id, 81
FROM public.brands b WHERE b.slug = 'tamashii-nations'
ON CONFLICT (slug) DO NOTHING;

-- Good Smile lines
INSERT INTO public.product_lines (slug, name, brand_id, sort_order)
SELECT 'nendoroid', 'Nendoroid', b.id, 60
FROM public.brands b WHERE b.slug = 'good-smile'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.product_lines (slug, name, brand_id, sort_order)
SELECT 'figma', 'figma', b.id, 61
FROM public.brands b WHERE b.slug = 'good-smile'
ON CONFLICT (slug) DO NOTHING;

-- MegaHouse lines
INSERT INTO public.product_lines (slug, name, brand_id, sort_order)
SELECT 'g-e-m', 'G.E.M.', b.id, 40
FROM public.brands b WHERE b.slug = 'megahouse'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.product_lines (slug, name, brand_id, sort_order)
SELECT 'portrait-of-pirates', 'Portrait Of Pirates', b.id, 41
FROM public.brands b WHERE b.slug = 'megahouse'
ON CONFLICT (slug) DO NOTHING;

-- Sentinel lines
INSERT INTO public.product_lines (slug, name, brand_id, sort_order)
SELECT 'marvel-fighting-armor', 'Marvel Fighting Armor', b.id, 0
FROM public.brands b WHERE b.slug = 'sentinel'
ON CONFLICT (slug) DO NOTHING;

-- ---------- 3. Series (global since migration 010, but product_line_id
-- still required as a hint; pick the most representative line).

INSERT INTO public.series (slug, name, product_line_id, sort_order)
SELECT 'star-wars', 'Star Wars', l.id, 0
FROM public.product_lines l WHERE l.slug = 'sh-figuarts'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.series (slug, name, product_line_id, sort_order)
SELECT 'sailor-moon', 'Sailor Moon', l.id, 0
FROM public.product_lines l WHERE l.slug = 'sh-figuarts'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.series (slug, name, product_line_id, sort_order)
SELECT 'batman', 'Batman', l.id, 0
FROM public.product_lines l WHERE l.slug = 'sh-figuarts'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.series (slug, name, product_line_id, sort_order)
SELECT 'dr-stone', 'Dr. Stone', l.id, 0
FROM public.product_lines l WHERE l.slug = 'figuarts-zero'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.series (slug, name, product_line_id, sort_order)
SELECT 'power-rangers', 'Power Rangers', l.id, 0
FROM public.product_lines l WHERE l.slug = 'figzero'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.series (slug, name, product_line_id, sort_order)
SELECT 'gundam', 'Mobile Suit Gundam', l.id, 0
FROM public.product_lines l WHERE l.slug = 'metal-robot'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.series (slug, name, product_line_id, sort_order)
SELECT 'jojos-bizarre-adventure', 'JoJo''s Bizarre Adventure', l.id, 0
FROM public.product_lines l WHERE l.slug = 'nendoroid'
ON CONFLICT (slug) DO NOTHING;

-- ---------- 4. Draft products for non-crawler-staged sources ----------
-- Each row sits at status='draft' (RLS-hidden from anon) with price 0 +
-- stock_qty 1. The description holds the source URL as a TODO marker so
-- the admin can find the upstream listing while filling in the rest.
-- Helper inserts use CTE-style id lookups to keep the SQL flat.

-- Good Smile / Nendoroid (4 working URLs)
INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'nendoroid-shinobu-kocho',
  'Nendoroid Shinobu Kocho',
  (SELECT id FROM public.product_lines WHERE slug = 'nendoroid'),
  (SELECT id FROM public.series WHERE slug = 'demon-slayer'),
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://www.goodsmile.com/en/product/9147/Nendoroid+Shinobu+Kocho'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'nendoroid-nezuko-kamado',
  'Nendoroid Nezuko Kamado',
  (SELECT id FROM public.product_lines WHERE slug = 'nendoroid'),
  (SELECT id FROM public.series WHERE slug = 'demon-slayer'),
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://www.goodsmile.com/en/product/6433/Nendoroid+Nezuko+Kamado'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'nendoroid-jace-beleren',
  'Nendoroid Jace Beleren',
  (SELECT id FROM public.product_lines WHERE slug = 'nendoroid'),
  NULL,
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://www.goodsmile.com/en/product/9685/Nendoroid+Jace+Beleren'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'nendoroid-chandra-nalaar',
  'Nendoroid Chandra Nalaar',
  (SELECT id FROM public.product_lines WHERE slug = 'nendoroid'),
  NULL,
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://www.goodsmile.com/en/product/9778/Nendoroid+Chandra+Nalaar'
ON CONFLICT (slug) DO NOTHING;

-- Good Smile / figma (2)
INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'figma-kyojuro-rengoku',
  'figma Kyojuro Rengoku',
  (SELECT id FROM public.product_lines WHERE slug = 'figma'),
  (SELECT id FROM public.series WHERE slug = 'demon-slayer'),
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://www.goodsmile.com/en/product/9776/figma+Kyojuro+Rengoku'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'figma-hikaru-shidou',
  'figma Hikaru Shidou',
  (SELECT id FROM public.product_lines WHERE slug = 'figma'),
  NULL,
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://www.goodsmile.com/en/product/3547/figma+Hikaru+Shidou'
ON CONFLICT (slug) DO NOTHING;

-- MegaHouse / G.E.M. (1) + POP (1)
INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'gem-anya',
  'G.E.M. Series Spy x Family Palm Size Anya',
  (SELECT id FROM public.product_lines WHERE slug = 'g-e-m'),
  (SELECT id FROM public.series WHERE slug = 'spy-family'),
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://en.megahobby.jp/products/g-e-m-series-spyxfamily-palmsize-anya-chan'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'pop-zoro-asura',
  'Portrait Of Pirates One Piece WA-MAXIMUM Roronoa Zoro Demon Aura Nine Sword Style Asura',
  (SELECT id FROM public.product_lines WHERE slug = 'portrait-of-pirates'),
  (SELECT id FROM public.series WHERE slug = 'one-piece'),
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://en.megahobby.jp/products/portrait-of-pirates-one-piece-wa-maximum-roronoa-zoro-demon-aura-nine-sword-style-asura'
ON CONFLICT (slug) DO NOTHING;

-- Sentinel / Marvel Fighting Armor (6 from shfiguarts.com + 1 Loki from BBTS)
INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'sentinel-wolverine-fighting-armor',
  'Sentinel Marvel Wolverine Fighting Armor',
  (SELECT id FROM public.product_lines WHERE slug = 'marvel-fighting-armor'),
  (SELECT id FROM public.series WHERE slug = 'marvel'),
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://www.shfiguarts.com/products/detail/10387/Sentinel---Marvel-Wolverine-Fighting-Armor-Af.html'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'sentinel-thor-fighting-armor',
  'Sentinel Marvel Thor Fighting Armor',
  (SELECT id FROM public.product_lines WHERE slug = 'marvel-fighting-armor'),
  (SELECT id FROM public.series WHERE slug = 'marvel'),
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://www.shfiguarts.com/products/detail/10388/Sen-ti-nel-Sentinel---Marvel---Thor-Sentinel-Fighting-Armor.html'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'sentinel-iron-spider-fighting-armor',
  'Sentinel Marvel Iron Spider Fighting Armor',
  (SELECT id FROM public.product_lines WHERE slug = 'marvel-fighting-armor'),
  (SELECT id FROM public.series WHERE slug = 'marvel'),
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://www.shfiguarts.com/products/detail/10389/Sen-ti-nel-Iron-Spider-Marvel-Sentinel-Marvel-Series-2.html'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'sentinel-iron-man-fighting-armor',
  'Sentinel Marvel Iron Man Fighting Armor',
  (SELECT id FROM public.product_lines WHERE slug = 'marvel-fighting-armor'),
  (SELECT id FROM public.series WHERE slug = 'marvel'),
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://www.shfiguarts.com/products/detail/10390/Sen-ti-nel---Marvel---Iron-Man-Sentinel-Fighting-Armor.html'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'sentinel-black-panther-fighting-armor',
  'Sentinel Marvel Black Panther Fighting Armor',
  (SELECT id FROM public.product_lines WHERE slug = 'marvel-fighting-armor'),
  (SELECT id FROM public.series WHERE slug = 'marvel'),
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://www.shfiguarts.com/products/detail/10392/Sen-ti-nel-Sentinel---Marvel-Black-Panther-Sentinel-Fighting-Armor.html'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'sentinel-war-machine-fighting-armor',
  'Sentinel Marvel War Machine Fighting Armor',
  (SELECT id FROM public.product_lines WHERE slug = 'marvel-fighting-armor'),
  (SELECT id FROM public.series WHERE slug = 'marvel'),
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://www.shfiguarts.com/products/detail/10393/Sentinel---Marvel-War-Machine-Sentinel-Fighting-Armor.html'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'sentinel-loki-fighting-armor',
  'Sentinel Marvel Loki Fighting Armor',
  (SELECT id FROM public.product_lines WHERE slug = 'marvel-fighting-armor'),
  (SELECT id FROM public.series WHERE slug = 'marvel'),
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://www.bigbadtoystore.com/product/marvel-fighting-armor-loki-figure-111458'
ON CONFLICT (slug) DO NOTHING;

-- Nendoroid items removed from Good Smile site -- staged with MFC URLs.
INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'nendoroid-1743-maki-zenin',
  'Nendoroid 1743 Maki Zenin',
  (SELECT id FROM public.product_lines WHERE slug = 'nendoroid'),
  (SELECT id FROM public.series WHERE slug = 'jujutsu-kaisen'),
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://myfigurecollection.net/item/1297008 (removed from goodsmile.com)'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products
  (slug, name, product_line_id, series_id, price, currency, condition, status, stock_qty, description)
SELECT
  'nendoroid-1624-dio-brando',
  'Nendoroid 1624 Dio Brando',
  (SELECT id FROM public.product_lines WHERE slug = 'nendoroid'),
  (SELECT id FROM public.series WHERE slug = 'jojos-bizarre-adventure'),
  0, 'USD', 'mint_sealed', 'draft', 1,
  'TODO: fill from https://myfigurecollection.net/item/1086738 (removed from goodsmile.com)'
ON CONFLICT (slug) DO NOTHING;
