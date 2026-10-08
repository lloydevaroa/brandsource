import Link from "next/link";
import { createServiceSupabase } from "@/lib/supabase/server";
import { requireStaffProfile } from "../../staff-guard";
import { getCatalog } from "@/lib/catalog";
import { getRateTiers, isMissingTierSchema } from "@/lib/rate-tiers";
import { OrderBuilder, type EditingOrder } from "./OrderBuilder";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const title = edit ? "Edit PO order" : "New PO order";
  const staffResult = await requireStaffProfile(title);
  if ("guard" in staffResult) return staffResult.guard;

  const supabase = createServiceSupabase();
  const tiers = await getRateTiers();
  let { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, rate_tier_id")
    .eq("client_type", "managed")
    .order("name", { ascending: true });
  // supabase/rate-tiers.sql not run yet: carry on at RRP.
  if (error && isMissingTierSchema(error.message)) {
    const retry = await supabase.from("clients").select("id, name").eq("client_type", "managed").order("name", { ascending: true });
    clients = (retry.data ?? []).map((c) => ({ ...c, rate_tier_id: null }));
    error = retry.error;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-red-600">Could not load clients: {error.message}</p>
      </div>
    );
  }

  let editing: EditingOrder | undefined;
  if (edit) {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, payment_method, status, po_number, client_id, rate_tier_id, order_lines ( id, quantity, unit_price, list_price, configuration, product:products ( slug ), sub_orders ( status ) )"
      )
      .eq("id", edit)
      .single();
    const blocked =
      orderError || !order
        ? "That order could not be found."
        : order.payment_method !== "po"
          ? "Only purchase-order orders can be edited here."
          : order.status === "invoiced"
            ? "This order has already been sent to Xero as an invoice, so it can't be edited here."
            : null;
    if (blocked || !order) {
      return (
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← Team dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-red-600">{blocked}</p>
        </div>
      );
    }
    type Line = {
      id: string;
      quantity: number;
      unit_price: number | string;
      list_price: number | string | null;
      configuration: Record<string, string | string[]>;
      product: { slug: string } | null;
      sub_orders: { status: string }[];
    };
    editing = {
      orderId: order.id,
      clientId: order.client_id,
      rateTierId: order.rate_tier_id ?? null,
      poNumber: order.po_number ?? "",
      lines: (order.order_lines as unknown as Line[]).map((l) => ({
        id: l.id,
        lineId: l.id,
        productSlug: l.product?.slug ?? "",
        configuration: l.configuration,
        quantity: l.quantity,
        listPrice: Number(l.list_price ?? l.unit_price),
        boardStatus: l.sub_orders[0]?.status ?? "new_order",
      })),
    };
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Team dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {editing
            ? "Change the client, rate tier, PO number, quantities or items. Items already on the board keep their status and assignee."
            : "Create an order on behalf of a managed client — no card payment, invoiced later via Xero on their credit terms."}
        </p>

        <div className="mt-8">
          <OrderBuilder clients={clients ?? []} catalog={await getCatalog()} tiers={tiers} editing={editing} />
        </div>
      </div>
    </div>
  );
}
