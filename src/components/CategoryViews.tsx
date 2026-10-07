import Image from "next/image";
import Link from "next/link";
import type { Category, CategoryProduct } from "@/lib/categories";
import { SampleBadge } from "@/components/SampleBadge";

export function Breadcrumb({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
      {trail.map((t, i) => (
        <span key={t.label}>
          {i > 0 ? <span className="mx-2 text-zinc-300">/</span> : null}
          {t.href ? (
            <Link href={t.href} className="hover:text-zinc-900">
              {t.label}
            </Link>
          ) : (
            <span className="text-zinc-700">{t.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** A subcategory tile. Empty categories are filtered out upstream in getCategories. */
export function CategoryTile({ category }: { category: Category }) {
  return (
    <li>
      <Link href={`/category/${category.slug}`} className="group block">
        <div
          className={`relative aspect-square overflow-hidden rounded-lg border border-zinc-200 ${
            category.image ? "bg-white" : "bg-zinc-100"
          } group-hover:border-brand-charcoal`}
        >
          {category.image ? (
            <Image
              src={category.image}
              alt=""
              fill
              className="object-contain"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : null}
        </div>
        <h2 className="mt-3 text-sm font-bold leading-snug">
          {category.name} <span className="text-brand-orange" aria-hidden>&rarr;</span>
        </h2>
      </Link>
    </li>
  );
}

export function ProductCard({ product }: { product: CategoryProduct }) {
  return (
    <li className="overflow-hidden rounded-xl border border-zinc-200 bg-white hover:border-zinc-400">
      <Link href={`/products/${product.slug}`} className="relative block aspect-square bg-white">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : null}
        {product.sample_label ? <SampleBadge label={product.sample_label} className="absolute left-3 top-3" /> : null}
      </Link>
      <div className="p-5">
        <h3 className="font-medium">{product.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-zinc-600">{product.short_description}</p>
        <p className="mt-4 text-xs uppercase tracking-wide text-zinc-400">
          {product.min_order_qty > 1 ? `MOQ ${product.min_order_qty} · ` : ""}
          {product.unit_price != null ? `From $${product.unit_price.toFixed(2)} NZD` : "Get a quote"}
        </p>
        <Link
          href={`/products/${product.slug}`}
          className="mt-4 inline-block px-5 py-2.5 text-sm rounded bg-brand-orange text-white font-bold uppercase tracking-wide hover:bg-[#e64300]"
        >
          Configure
        </Link>
      </div>
    </li>
  );
}
