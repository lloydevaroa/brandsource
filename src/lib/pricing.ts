import type { CatalogProduct } from "@/lib/catalog";

/** Rate tier price: RRP less a percentage, to the cent. Same rule as lib/rate-tiers.ts. */
export function applyTierDiscount(rrp: number, discountPercent: number) {
  return Math.round(rrp * (1 - discountPercent / 100) * 100) / 100;
}

/**
 * Unit price for a configured line: product base + any option price deltas
 * (the RRP), less the rate tier discount when one applies.
 */
export function priceForItem(
  catalog: CatalogProduct[],
  productSlug: string,
  configuration: Record<string, string | string[]>,
  discountPercent = 0
) {
  const product = catalog.find((p) => p.slug === productSlug);
  if (!product) return null;
  const base = product.unit_price ?? 0;
  const delta = product.option_groups.reduce((sum, g) => {
    const selected = configuration[g.key];
    if (!selected) return sum;
    const keys = Array.isArray(selected) ? selected : [selected];
    return (
      sum + keys.reduce((s, k) => s + (g.choices.find((c) => c.key === k)?.price_delta ?? 0), 0)
    );
  }, 0);
  const rrp = base + delta;
  return discountPercent > 0 ? applyTierDiscount(rrp, discountPercent) : rrp;
}

/** Human-readable "Group: choice" summary of a line's selected options. */
export function configurationSummary(
  catalog: CatalogProduct[],
  productSlug: string,
  configuration: Record<string, string | string[]>
) {
  const product = catalog.find((p) => p.slug === productSlug);
  if (!product) return "";
  return product.option_groups
    .flatMap((g) => {
      const selected = configuration[g.key];
      if (!selected || (Array.isArray(selected) && selected.length === 0)) return [];
      const keys = Array.isArray(selected) ? selected : [selected];
      const labels = keys
        .map((k) => g.choices.find((c) => c.key === k)?.label)
        .filter(Boolean)
        .join(", ");
      return labels ? [`${g.label}: ${labels}`] : [];
    })
    .join(" · ");
}
