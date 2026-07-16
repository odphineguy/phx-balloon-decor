-- AI Visualizer leads. Written by api/leads.js using the service-role key
-- only. RLS is enabled with NO policies: the service role bypasses RLS, and
-- anon/authenticated clients get no access at all.

create table if not exists public.balloon_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  name text not null,
  email text not null,
  phone text not null,
  event_date date,
  style_id text,
  colors jsonb,
  created_at timestamptz not null default now()
);

alter table public.balloon_leads enable row level security;

create index if not exists balloon_leads_tenant_created_idx
  on public.balloon_leads (tenant_id, created_at desc);
