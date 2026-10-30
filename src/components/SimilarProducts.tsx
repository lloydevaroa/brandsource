import Image from "next/image";
import Link from "next/link";
import type { Category, CategoryProduct } from "@/lib/categories";
import { SampleBadge } from "@/components/SampleBadge";

const MAX_SIMILAR = 6;

/**
 * Other products from the same category, nearest in price first (products
 * without a price go last), so shoppers who haven't found the right item can
 * keep browsing.
 */
export function similarProducts(category: Category, current: { slug: string; unit_price: number | null }) {
  const price = current.unit_price;
  const gap = (p: CategoryProduct) =>
    p.unit_price == null ? Infinity : price == null ? 0 : Math.abs(p.unit_price - price);
  return category.products
    .filter((p) => p.slug !== current.slug)
    .sort((a, b) => gap(a) - gap(b) || a.name.localeCompare(b.name))
    .slice(0, MAX_SIMILAR);
}

export function SimilarProducts({ category, products }: { category: Category; products: CategoryProduct[] }) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="similar-products" className="mt-16 border-t border-zinc-200 pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="similar-products" className="text-xl font-semibold tracking-tight">
          Similar products
        </h2>
        <Link href={`/category/${category.slug}`} className="text-sm font-bold hover:underline">
          See all {category.name} <span className="text-brand-orange" aria-hidden>&rarr;</span>
        </Link>
      </div>
      <ul className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {products.map((p) => (
          <li key={p.slug}>
            <Link href={`/products/${p.slug}`} className="group block">
              <div className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-white group-hover:border-brand-charcoal">
                {p.image ? (
                  <Image
                    src={p.image}
                    alt=""
                    fill
                    className="object-contain"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, (max-width: 1536px) 20vw, 17vw"
                  />
                ) : null}
                {p.sample_label ? <SampleBadge label={p.sample_label} className="absolute left-3 top-3" /> : null}
              </div>
              <h3 className="mt-3 text-sm font-bold leading-snug">
                {p.name} <span className="text-brand-orange" aria-hidden>&rarr;</span>
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                {p.unit_price != null ? `From $${p.unit_price.toFixed(2)} NZD` : "Get a quote"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
