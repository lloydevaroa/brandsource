import Image from "next/image";
import Link from "next/link";
import type { Category, CategoryProduct } from "@/lib/categories";

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

/** A subcategory tile. Empty categories render as "Coming soon" but still link through. */
export function CategoryTile({ category, productCount }: { category: Category; productCount: number }) {
  return (
    <li>
      <Link
        href={`/category/${category.slug}`}
        className="group block overflow-hidden rounded-xl border border-zinc-200 bg-white hover:border-zinc-400"
      >
        <div className="relative aspect-[4/3] bg-zinc-100">
          {category.image ? (
            <Image
              src={category.image}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h2 className="font-medium group-hover:underline">{category.name}</h2>
          {productCount === 0 ? (
            <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-500">
              Coming soon
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

export function ProductCard({ product }: { product: CategoryProduct }) {
  return (
    <li className="overflow-hidden rounded-xl border border-zinc-200 bg-white hover:border-zinc-400">
      <Link href={`/products/${product.slug}`} className="relative block aspect-[4/3] bg-zinc-100">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : null}
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
          className="mt-4 inline-block rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Configure
        </Link>
      </div>
    </li>
  );
}
