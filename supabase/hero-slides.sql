-- Hero image sliders for the home page and each category page. Run once in the
-- Supabase SQL editor (safe to re-run). page_key is 'home' or a category slug.
-- Images live in a public Storage bucket; staff manage them at /admin/hero.

create table if not exists public.hero_slides (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  image_url text not null,
  storage_path text not null,
  headline text,
  button_label text,
  button_href text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists hero_slides_page_idx on public.hero_slides (page_key, sort_order);

-- Only the server (service role) reads or writes this table.
alter table public.hero_slides enable row level security;

insert into storage.buckets (id, name, public)
values ('hero-images', 'hero-images', true)
on conflict (id) do nothing;
