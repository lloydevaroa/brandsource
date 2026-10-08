import { getCatalog } from "@/lib/catalog";
import { getViewerTier } from "@/lib/rate-tiers";
import { CartView } from "./CartView";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const tier = await getViewerTier();
  return <CartView catalog={await getCatalog()} tier={tier ? { name: tier.name, discountPercent: tier.discount_percent } : null} />;
}
