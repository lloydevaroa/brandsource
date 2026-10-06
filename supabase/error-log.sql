-- Error log: staff-facing failures (order creation, Xero push) are recorded here
-- with a timestamp and short reference so a forwarded message can be traced.
-- Rows older than 7 days are deleted automatically whenever a new error is logged.
-- Run once in the Supabase SQL editor.
begin;

create table public.error_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  area text not null,
  summary text not null,
  detail text,
  staff_id uuid references public.profiles(id) on delete set null
);

create index error_log_occurred_at_idx on public.error_log (occurred_at desc);

-- Server-side only (service-role key); RLS on with no policies keeps it off the anon key.
alter table public.error_log enable row level security;

commit;
