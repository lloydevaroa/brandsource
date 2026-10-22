-- Lets a category page's hero slide also appear on the home page, as a featured
-- band between the first and second row of category tiles. Ticked per slide at
-- /admin/hero. Run once in the Supabase SQL editor (safe to re-run).

alter table public.hero_slides
  add column if not exists show_on_home boolean not null default false;
