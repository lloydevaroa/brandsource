import { getCatalog } from "@/lib/catalog";
import { getRateTiers, getViewerTier } from "@/lib/rate-tiers";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { createServiceSupabase } from "@/lib/supabase/server";
import { CartView, type StaffOrdering } from "./CartView";

export const dynamic = "force-dynamic";

/** Managed clients a staff member can raise a PO order for, with their default tier. Null for non-staff. */
async function getStaffOrdering(): Promise<StaffOrdering | null> {
  try {
    const profile = await syncCurrentProfile();
    if (!profile || (profile.role !== "admin" && profile.role !== "manager")) return null;
    const supabase = createServiceSupabase();
    const [tiers, withTier] = await Promise.all([
      getRateTiers(),
      supabase.from("clients").select("id, name, rate_tier_id").eq("client_type", "managed").order("name", { ascending: true }),
    ]);
    // supabase/rate-tiers.sql not run yet: list clients without tiers.
    const rows = withTier.error
      ? ((await supabase.from("clients").select("id, name").eq("client_type", "managed").order("name", { ascending: true })).data ?? []).map((c) => ({ ...c, rate_tier_id: null }))
      : withTier.data ?? [];
    return {
      clients: rows.map((c) => {
        const tier = tiers.find((t) => t.id === c.rate_tier_id);
        return { id: c.id, name: c.name, tierName: tier?.name ?? "Retail", tierDiscount: tier?.discount_percent ?? 0 };
      }),
    };
  } catch {
    return null;
  }
}

export default async function CartPage() {
  const [tier, staff] = await Promise.all([getViewerTier(), getStaffOrdering()]);
  return (
    <CartView
      catalog={await getCatalog()}
      tier={tier ? { name: tier.name, discountPercent: tier.discount_percent } : null}
      staff={staff}
    />
  );
}
