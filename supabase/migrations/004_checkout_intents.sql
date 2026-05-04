-- ============================================================
-- Checkout intents: server-side audit of cart submissions
-- ============================================================

create table checkout_intents (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  items         jsonb not null,
  totals        jsonb not null,
  user_agent    text,
  referrer      text,
  email_sent_at timestamptz
);

create index on checkout_intents (created_at desc);

alter table checkout_intents enable row level security;

-- No anon read/write. Service role bypasses RLS, used by server actions.
-- Intentionally no policies → anon/authenticated denied.
