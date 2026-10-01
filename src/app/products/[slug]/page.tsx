import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/catalog";
import { categoryForProduct, getCategories } from "@/lib/categories";
import { ProductDetailsSections } from "@/components/ProductDetailsSections";
import { ProductConfigurator } from "@/components/ProductConfigurator";
import { SiteHeader } from "@/components/SiteHeader";

export const revalidate = 60;

export async function generateStaticParams() {
  return (await getCatalog()).map((p) => ({ slug: p.slug }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const product = catalog.find((p) => p.slug === slug);
  if (!product) notFound();
  const category = categoryForProduct(await getCategories(), slug);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href={category ? `/category/${category.slug}` : "/category/trade-show-and-events"}
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← {category ? category.name : "Trade Show & Events"}
        </Link>
        {product.example_image_urls[0] ? (
          <div className="relative mt-6 aspect-[16/10] overflow-hidden rounded-xl bg-zinc-100">
            <Image
              src={product.example_image_urls[0]}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
        ) : null}
        {product.example_image_urls.length > 1 ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {product.example_image_urls.slice(1).map((src) => (
              <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100">
                <Image src={src} alt="" fill className="object-cover" sizes="50vw" />
              </div>
            ))}
          </div>
        ) : null}
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          {product.name}
        </h1>
        <p className="mt-2 text-zinc-600">{product.short_description}</p>
        <p className="mt-2 text-sm text-zinc-500">
          {product.unit_price == null ? "Get a quote" : `Flat pricing · $${product.unit_price.toFixed(2)} NZD`}
          {product.min_order_qty > 1 ? ` · MOQ ${product.min_order_qty}` : ""}
        </p>

        <ProductConfigurator product={product} />

        {product.product_details ? <ProductDetailsSections d={product.product_details} /> : null}
      </div>
    </div>
  );
}
