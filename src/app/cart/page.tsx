import { getRateTiers, getViewerTier } from "@/lib/rate-tiers";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { CartView, type StaffOrdering } from "./CartView";

export const dynamic = "force-dynamic";

/**
 * Tells the cart whether the viewer is staff, and sends the (small) list of rate tiers. The managed
 * clients, about 500 of them, are loaded by the staff panel itself when it opens (see
 * /api/staff/cart-clients), so they are not carried in every cart page. Null for non-staff.
 */
async function getStaffOrdering(): Promise<StaffOrdering | null> {
  try {
    const profile = await syncCurrentProfile();
    if (!profile || (profile.role !== "admin" && profile.role !== "manager")) return null;
    const tiers = await getRateTiers();
    return { tiers: tiers.map((t) => ({ id: t.id, name: t.name, discountPercent: t.discount_percent })) };
  } catch {
    return null;
  }
}

export default async function CartPage() {
  const [tier, staff] = await Promise.all([getViewerTier(), getStaffOrdering()]);
  return <CartView tier={tier ? { name: tier.name, discountPercent: tier.discount_percent } : null} staff={staff} />;
}
