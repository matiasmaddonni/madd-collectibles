-- First-party analytics mirror. Vercel Web Analytics keeps running as
-- the bird's-eye view; this table is what the custom admin dashboard
-- queries for per-product engagement (views vs. WhatsApp clicks vs.
-- cart adds), session-level dwell time, funnel drop-off, etc.
--
-- Events are written by the public `/api/track` route. The route hashes
-- the visitor IP with the UTC date so unique-visitor counts work
-- without storing PII, and the session_id is stitched together
-- client-side (sessionStorage UUID, 30-min idle window).
--
-- 180-day purge keeps the row count well under the free-tier 500MB
-- cap even if traffic 10x's. Done in SQL so it ships with the schema
-- rather than relying on a separate cron worker.

create table if not exists public.analytics_events (
  id          bigserial primary key,
  event       text not null,
  props       jsonb not null default '{}'::jsonb,
  session_id  text not null,
  ip_hash     text,
  path        text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists analytics_events_event_created_idx
  on public.analytics_events (event, created_at desc);
create index if not exists analytics_events_session_idx
  on public.analytics_events (session_id, created_at);
create index if not exists analytics_events_created_idx
  on public.analytics_events (created_at desc);
-- Per-product lookups (top viewed, top cart-added) hit props->>'slug'.
create index if not exists analytics_events_slug_idx
  on public.analytics_events ((props->>'slug'))
  where props ? 'slug';

alter table public.analytics_events enable row level security;

-- Service role bypasses RLS, but a future-proofing grant keeps the
-- table reachable via the Data API after the Oct 2026 auto-expose
-- change (see AGENTS.md).
grant all on public.analytics_events to service_role;
grant usage, select on sequence public.analytics_events_id_seq to service_role;

-- No public SELECT / INSERT / UPDATE / DELETE. The `/api/track` route
-- runs server-side with the service role; anon never touches the
-- table directly. This avoids letting any browser flood the table
-- with bogus events via the auto-generated PostgREST endpoint.

-- Auto-purge anything older than 180 days. Called from a Supabase
-- cron job (set up separately in the dashboard) or invoked manually.
create or replace function public.purge_analytics_events()
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  deleted integer;
begin
  delete from public.analytics_events
   where created_at < now() - interval '180 days';
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

revoke all on function public.purge_analytics_events() from public;
grant execute on function public.purge_analytics_events() to service_role;
