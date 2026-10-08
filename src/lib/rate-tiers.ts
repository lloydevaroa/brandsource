import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { applyTierDiscount } from "@/lib/pricing";

export type RateTier = { id: string; level: number; name: string; discount_percent: number };

/** Shown until supabase/rate-tiers.sql has been run, so nothing breaks. */
const RETAIL_FALLBACK: RateTier = { id: "", level: 5, name: "Retail", discount_percent: 0 };

export const tierPrice = applyTierDiscount;

export function isMissingTierSchema(message: string | undefined) {
  return !!message && /rate_tier|rate_tiers|list_price/.test(message);
}

/** All tiers, best discount first for display (Platinum at the top). */
export async function getRateTiers(): Promise<RateTier[]> {
  const { data, error } = await createServiceSupabase()
    .from("rate_tiers")
    .select("id, level, name, discount_percent")
    .order("level", { ascending: true });
  if (error) {
    if (isMissingTierSchema(error.message) || /relation/.test(error.message)) return [RETAIL_FALLBACK];
    throw new Error(error.message);
  }
  return data.map((t) => ({ ...t, discount_percent: Number(t.discount_percent) }));
}

export async function getRateTier(id: string | null | undefined): Promise<RateTier | null> {
  if (!id) return null;
  return (await getRateTiers()).find((t) => t.id === id) ?? null;
}

/**
 * The tier for whoever is signed in: their profile's client's tier, or null
 * (Retail) for anonymous visitors, customers with no linked client, and
 * clients with no tier set. Never throws: pricing must fall back to RRP.
 */
export async function getViewerTier(): Promise<RateTier | null> {
  try {
    const profile = await syncCurrentProfile();
    if (!profile?.client_id) return null;
    const { data, error } = await createServiceSupabase()
      .from("clients")
      .select("rate_tier_id")
      .eq("id", profile.client_id)
      .single();
    if (error || !data?.rate_tier_id) return null;
    const tier = await getRateTier(data.rate_tier_id);
    return tier && tier.discount_percent > 0 ? tier : null;
  } catch {
    return null;
  }
}
