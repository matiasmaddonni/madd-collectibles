-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

create table brands (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  logo_url    text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table product_lines (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete restrict,
  slug        text not null unique,
  name        text not null,
  description text,
  banner_url  text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table series (
  id              uuid primary key default gen_random_uuid(),
  product_line_id uuid not null references product_lines(id) on delete restrict,
  slug            text not null unique,
  name            text not null,
  sort_order      integer not null default 0
);

create table products (
  id              uuid primary key default gen_random_uuid(),
  product_line_id uuid not null references product_lines(id) on delete restrict,
  series_id       uuid references series(id) on delete set null,
  sku             text unique,
  name            text not null,
  slug            text not null unique,
  description     text,
  price           numeric(10, 2) not null,
  cost_price      numeric(10, 2),
  condition       text not null check (condition in ('mint_sealed', 'mint_open', 'near_mint', 'good', 'fair')),
  status          text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  stock_qty       integer not null default 1,
  is_featured     boolean not null default false,
  release_year    smallint,
  tags            text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url        text not null,
  alt        text,
  is_primary boolean not null default false,
  sort_order integer not null default 0
);

-- ============================================================
-- INDEXES
-- ============================================================

create index on product_lines (brand_id);
create index on series (product_line_id);
create index on products (product_line_id);
create index on products (series_id);
create index on products (status);
create index on products (is_featured);
create index on product_images (product_id);

-- ============================================================
-- updated_at trigger
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_updated_at
  before update on products
  for each row execute procedure set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table brands         enable row level security;
alter table product_lines  enable row level security;
alter table series         enable row level security;
alter table products       enable row level security;
alter table product_images enable row level security;

-- Public SELECT on all tables (cost_price excluded via view)
create policy "public can read brands"
  on brands for select to anon, authenticated using (true);

create policy "public can read product_lines"
  on product_lines for select to anon, authenticated using (true);

create policy "public can read series"
  on series for select to anon, authenticated using (true);

create policy "public can read products"
  on products for select to anon, authenticated using (true);

create policy "public can read product_images"
  on product_images for select to anon, authenticated using (true);

-- ============================================================
-- PUBLIC VIEW (hides cost_price)
-- ============================================================

create view public_products with (security_invoker = true) as
  select
    id,
    product_line_id,
    series_id,
    sku,
    name,
    slug,
    description,
    price,
    condition,
    status,
    stock_qty,
    is_featured,
    release_year,
    tags,
    created_at,
    updated_at
  from products;
