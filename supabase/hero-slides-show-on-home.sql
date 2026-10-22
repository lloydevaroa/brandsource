-- Lets a category page's hero slide also appear on the home page, as a featured
-- band between the first and second row of category tiles. Ticked per slide at
-- /admin/hero. Run once in the Supabase SQL editor (safe to re-run).

alter table public.hero_slides
  add column if not exists show_on_home boolean not null default false;

-- Only one slide can be featured on the home page at a time. The admin clears the
-- previous one when another is ticked; this index makes the database enforce it too.
create unique index if not exists hero_slides_one_home
  on public.hero_slides (show_on_home)
  where show_on_home;
