import { cache } from "react";
import { createServiceSupabase } from "@/lib/supabase/server";

export type HeroSlide = {
  id: string;
  image_url: string;
  headline: string | null;
  button_label: string | null;
  button_href: string | null;
};

/** page_key holding the sitewide default hero, shown on any page with no slides of its own. */
export const DEFAULT_HERO_KEY = "default";

async function fetchSlides(pageKey: string): Promise<HeroSlide[]> {
  const { data, error } = await createServiceSupabase()
    .from("hero_slides")
    .select("id, image_url, headline, button_label, button_href")
    .eq("page_key", pageKey)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return [];
  return data as HeroSlide[];
}

/** Active slides for a page ('home' or a category slug), in order. Falls back to the sitewide default; never throws: no slides means no hero. */
export const getHeroSlides = cache(async (pageKey: string): Promise<HeroSlide[]> => {
  try {
    const own = await fetchSlides(pageKey);
    if (own.length > 0 || pageKey === DEFAULT_HERO_KEY) return own;
    return await fetchSlides(DEFAULT_HERO_KEY);
  } catch {
    return [];
  }
});
