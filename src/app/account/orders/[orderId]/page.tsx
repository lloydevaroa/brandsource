import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { getCatalog } from "@/lib/catalog";
import { artworkDisplayName } from "@/lib/artwork";
import { orderReference } from "@/lib/emails/order-confirmation";
import { configurationSummary } from "@/lib/pricing";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { createServiceSupabase } from "@/lib/supabase/server";
import { ArtworkUploader } from "./ArtworkUploader";

export const dynamic = "force-dynamic";

type Product = { name: string; slug: string };
type Line = {
  id: string;
  quantity: number;
  configuration: Record<string, string | string[]> | null;
  products: Product | Product[] | null;
  artwork_files: { id: string; storage_path: string }[] | null;
};

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const profile = await syncCurrentProfile();
  if (!profile) notFound();

  const supabase = createServiceSupabase();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, customer_id, created_at, order_lines(id, quantity, configuration, products(name, slug), artwork_files(id, storage_path))"
    )
    .eq("id", orderId)
    .maybeSingle();
  const isStaff = profile.role === "admin" || profile.role === "manager";
  if (!order || order.status === "draft" || (!isStaff && order.customer_id !== profile.id)) notFound();

  const catalog = await getCatalog();
  const lines = ((order.order_lines ?? []) as unknown as Line[]).map((l) => {
    const product = Array.isArray(l.products) ? l.products[0] : l.products;
    const catalogProduct = catalog.find((p) => p.slug === product?.slug);
    return {
      id: l.id,
      name: product?.name ?? "Product",
      summary: product ? configurationSummary(catalog, product.slug, l.configuration ?? {}) : "",
      quantity: l.quantity,
      templateUrl: catalogProduct?.product_details?.template_url ?? null,
      files: (l.artwork_files ?? []).map((f) => ({ id: f.id, name: artworkDisplayName(f.storage_path) })),
    };
  });
  const waiting = lines.filter((l) => l.files.length === 0).length;

  return (
    <div className="min-h-screen bg-white text-brand-charcoal">
      <SiteHeader />
      <div className="mx-auto max-w-[90rem] px-6 [&>*]:max-w-3xl py-10">
        <Link href="/account" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Your account
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Order {orderReference(order.id)}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Placed {new Date(order.created_at).toLocaleDateString("en-NZ")}
        </p>

        {waiting > 0 ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            We need artwork for {waiting} of your {lines.length} item{lines.length === 1 ? "" : "s"}. Upload it below,
            against the product it is for. We proof each item before anything goes to production.
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            We have artwork for every item. We&apos;ll check it and send you a proof to approve.
          </div>
        )}

        <ul className="mt-8 space-y-4">
          {lines.map((l) => (
            <li key={l.id} className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{l.name}</p>
                  {l.summary ? <p className="mt-1 text-sm text-zinc-500">{l.summary}</p> : null}
                  <p className="mt-1 text-sm text-zinc-500">Qty {l.quantity}</p>
                </div>
                <span
                  className={`shrink-0 text-xs font-semibold uppercase tracking-wide ${
                    l.files.length > 0 ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {l.files.length > 0 ? "Artwork uploaded" : "Artwork needed"}
                </span>
              </div>
              <div className="mt-4 border-t border-zinc-100 pt-4">
                <ArtworkUploader orderId={order.id} lineId={l.id} files={l.files} templateUrl={l.templateUrl} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
