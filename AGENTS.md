<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Supabase migrations: explicit GRANTs on every new table

Starting **Oct 30, 2026**, Supabase stops auto-exposing newly created
`public` schema tables to the Data API (PostgREST / supabase-js).
Existing tables are grandfathered, but any `CREATE TABLE` added after
that date needs explicit grants or it will be silently unreachable via
the API.

Convention: every new `CREATE TABLE public.<name>` in
`supabase/migrations/` must be followed by grants matching the table's
intended access. Default boilerplate:

```sql
create table public.example (
  id uuid primary key default gen_random_uuid(),
  -- ...
);

-- Service role bypasses RLS — always grant.
grant all on public.example to service_role;

-- Public storefront reads (skip if admin-only).
grant select on public.example to anon, authenticated;

-- Authenticated writes (only if RLS policies allow). Otherwise omit.
-- grant insert, update, delete on public.example to authenticated;

alter table public.example enable row level security;
-- Policies …
```

RLS is still the security boundary; grants are the API-visibility gate.
Don't grant write privileges to `anon`/`authenticated` unless an RLS
policy actually permits the operation.
