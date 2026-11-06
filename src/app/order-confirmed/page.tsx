import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { getCatalog } from "@/lib/catalog";
import { orderReference } from "@/lib/emails/order-confirmation";
import { configurationSummary } from "@/lib/pricing";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { createServiceSupabase } from "@/lib/supabase/server";
import { ClearCart } from "./ClearCart";

export const dynamic = "force-dynamic";

function formatNZD(amount: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(amount);
}

type OrderLine = {
  id: string;
  quantity: number;
  unit_price: number;
  configuration: Record<string, string | string[]> | null;
  products: { name: string; slug: string } | { name: string; slug: string }[] | null;
  artwork_files: { id: string }[] | null;
};

export default async function OrderConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  if (!orderId) notFound();

  const profile = await syncCurrentProfile();
  if (!profile) notFound();

  const supabase = createServiceSupabase();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, created_at, total_amount, order_lines(id, quantity, unit_price, configuration, products(name, slug), artwork_files(id))"
    )
    .eq("id", orderId)
    .eq("customer_id", profile.id)
    .maybeSingle();
  if (!order) notFound();

  const catalog = await getCatalog();
  const lines = (order.order_lines ?? []) as unknown as OrderLine[];
  const items = lines.map((l) => {
    const product = Array.isArray(l.products) ? l.products[0] : l.products;
    return {
      id: l.id,
      name: product?.name ?? "Product",
      summary: product ? configurationSummary(catalog, product.slug, l.configuration ?? {}) : "",
      quantity: l.quantity,
      lineTotal: l.quantity * Number(l.unit_price),
      hasArtwork: (l.artwork_files ?? []).length > 0,
    };
  });
  const missingArtwork = items.filter((i) => !i.hasArtwork).length;
  // The Stripe webhook flips the order out of draft; it can lag the redirect by a few seconds.
  const confirmed = order.status !== "draft";
  const total = Number(order.total_amount) || items.reduce((s, i) => s + i.lineTotal, 0);

  return (
    <div className="min-h-screen bg-white text-brand-charcoal">
      <ClearCart />
      <SiteHeader />
      <div className="mx-auto max-w-[90rem] px-6 [&>*]:max-w-3xl py-10">
        {confirmed ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Payment received</p>
            <h1 className="mt-1 text-2xl font-semibold">Thanks, your order is in</h1>
            <p className="mt-2 text-sm text-emerald-900">
              Order {orderReference(order.id)} · placed {new Date(order.created_at).toLocaleDateString("en-NZ")}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">Confirming your payment</p>
            <h1 className="mt-1 text-2xl font-semibold">Hang tight, we&apos;re finalising your order</h1>
            <p className="mt-2 text-sm text-amber-900">
              Stripe has sent you back and we&apos;re waiting for the confirmation. Refresh this page in a
              moment. If it doesn&apos;t change, your order will still show under Your account once payment clears.
            </p>
          </div>
        )}

        <h2 className="mt-10 text-lg font-semibold">What happens next</h2>
        <ol className="mt-3 space-y-3 text-sm text-zinc-700">
          <li className="flex gap-3">
            <span className="font-semibold text-brand-orange">1.</span>
            <span>
              {missingArtwork > 0
                ? `${missingArtwork} item${missingArtwork === 1 ? " still needs" : "s still need"} artwork. Upload it any time from your order page.`
                : "We check your artwork on every item."}
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-semibold text-brand-orange">2.</span>
            <span>We send you a proof of each item to approve. Nothing goes to production until you say yes.</span>
          </li>
          <li className="flex gap-3">
            <span className="font-semibold text-brand-orange">3.</span>
            <span>Once approved, your order goes into production and we tell you when it is dispatched.</span>
          </li>
        </ol>

        <h2 className="mt-10 text-lg font-semibold">Your items</h2>
        <ul className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
          {items.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-4 p-4 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{i.name}</p>
                {i.summary ? <p className="mt-1 text-zinc-500">{i.summary}</p> : null}
                <p className="mt-1 text-zinc-500">
                  Qty {i.quantity} ·{" "}
                  {i.hasArtwork ? (
                    <span className="text-emerald-700">Artwork uploaded</span>
                  ) : (
                    <span className="text-amber-700">Artwork needed</span>
                  )}
                </p>
              </div>
              <span className="shrink-0 font-medium">{formatNZD(i.lineTotal)}</span>
            </li>
          ))}
          <li className="flex items-center justify-between p-4 text-sm">
            <span className="text-zinc-500">{confirmed ? "Total paid" : "Total"}</span>
            <span className="font-semibold">{formatNZD(total)}</span>
          </li>
        </ul>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/account/orders/${order.id}`}
            className="rounded bg-brand-orange px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#e64300]"
          >
            {missingArtwork > 0 ? "Upload artwork" : "View your order"}
          </Link>
          <Link
            href="/category/trade-show-and-events"
            className="rounded border border-brand-charcoal px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-brand-charcoal hover:bg-brand-charcoal hover:text-white"
          >
            Keep shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
