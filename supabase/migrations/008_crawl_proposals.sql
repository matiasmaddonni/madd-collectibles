-- ============================================================
-- 008 — Crawler proposal queue
--
-- The crawler (scripts/crawl.ts) NEVER writes to `products` or
-- `product_images` directly. Instead it stages each suggested
-- change as a row here. Admins review the diff in the UI and
-- approve/reject per field; approval triggers the real write.
--
-- One row per (product_id, field, source) — two sources can
-- propose the same field and admin picks the better one.
-- ============================================================

create table public.crawl_proposals (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id) on delete cascade,
  field           text not null,
  current_value   jsonb,
  proposed_value  jsonb not null,
  source          text not null,
  source_url      text,
  confidence      smallint not null default 50,
  status          text not null default 'pending',
  notes           text,
  fetched_at      timestamptz not null default now(),
  decided_at      timestamptz,
  decided_by      uuid references auth.users(id),
  constraint crawl_proposals_status_chk
    check (status in ('pending', 'approved', 'rejected')),
  constraint crawl_proposals_confidence_chk
    check (confidence between 0 and 100)
);

create index crawl_proposals_pending_idx
  on public.crawl_proposals (status, product_id) where status = 'pending';

create unique index crawl_proposals_unique_pending_idx
  on public.crawl_proposals (product_id, field, source) where status = 'pending';

alter table public.crawl_proposals enable row level security;
-- No policies: service role only.

-- Staged images go into product_images with is_primary = false, marked
-- with the source name so admin UI can render them as "candidate"
-- thumbnails next to manually-uploaded ones.
alter table public.product_images
  add column if not exists proposed_by_source text;

create index if not exists product_images_proposed_idx
  on public.product_images (product_id) where proposed_by_source is not null;
