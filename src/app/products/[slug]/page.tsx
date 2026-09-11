import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { catalog } from "@/data/catalog";

export function generateStaticParams() {
  return catalog.map((p) => ({ slug: p.slug }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = catalog.find((p) => p.slug === slug);
  if (!product) notFound();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/#products" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Trade Show products
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
          Flat pricing ·{" "}
          {product.unit_price == null ? "Price TBD (awaiting PO quotes)" : `$${product.unit_price} NZD`}
          {product.min_order_qty > 1 ? ` · MOQ ${product.min_order_qty}` : ""}
        </p>

        <form className="mt-10 space-y-8">
          {product.option_groups.map((g) => (
            <fieldset key={g.key} className="rounded-xl border border-zinc-200 bg-white p-5">
              <legend className="px-1 text-sm font-medium">
                {g.label}
                {g.required ? "" : " (optional)"}
                {g.selection === "multi" ? " — choose any" : ""}
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {g.choices.map((c) => (
                  <label
                    key={c.key}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-zinc-500"
                  >
                    <input
                      type={g.selection === "multi" ? "checkbox" : "radio"}
                      name={g.key}
                      value={c.key}
                      className="accent-zinc-900"
                      required={g.required && g.selection === "single"}
                    />
                    {c.label}
                    {c.price_delta ? (
                      <span className="text-xs text-zinc-400">
                        +${c.price_delta}
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <p className="text-sm text-zinc-500">
            Artwork upload &amp; checkout land in the next build slice (Clerk + Stripe + Supabase).
          </p>
          <button
            type="button"
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white opacity-60"
            disabled
          >
            Continue (coming soon)
          </button>
        </form>
      </div>
    </div>
  );
}
