import Link from "next/link";
import { createServiceSupabase } from "@/lib/supabase/server";
import { requireStaffProfile } from "./staff-guard";
import { updateSubOrderStatus, claimSubOrder } from "./actions";
import { SubOrderCard, type SubOrderCardData } from "./SubOrderCard";
import { STATUS_ORDER, STATUS_LABEL } from "./status";
import type { SubOrderStatus } from "@/lib/types";

export default async function AdminPage() {
  const staffResult = await requireStaffProfile("Team dashboard");
  if ("guard" in staffResult) return staffResult.guard;
  const { profile } = staffResult;
  const firstName = profile.full_name?.split(" ")[0] ?? null;

  const supabase = createServiceSupabase();

  const [{ data: subOrders, error }, { data: staff }, { count: noImageCount }] = await Promise.all([
    supabase
      .from("sub_orders")
      .select(
        `
        id,
        status,
        claimed_by,
        created_at,
        order_line:order_lines (
          id,
          quantity,
          configuration,
          product:products ( name ),
          artwork_files ( id )
        ),
        order:orders (
          id,
          payment_method,
          po_number,
          customer:profiles!orders_customer_id_fkey ( full_name, email ),
          client:clients ( name )
        )
      `
      )
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["admin", "manager"])
      .order("full_name", { ascending: true }),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .eq("example_image_urls", "{}"),
  ]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Team dashboard</h1>
        <p className="mt-2 text-red-600">Could not load orders: {error.message}</p>
      </div>
    );
  }

  // Supabase's untyped client can't infer to-one embed cardinality, so it
  // types these as arrays even though PostgREST returns single objects for
  // a belongs-to relation at runtime — cast to the shape we actually get.
  type Row = {
    id: string;
    status: string;
    claimed_by: string | null;
    created_at: string;
    order_line: {
      quantity: number;
      configuration: unknown;
      product: { name: string } | null;
      artwork_files: { id: string }[];
    } | null;
    order: {
      payment_method: "card" | "po";
      po_number: string | null;
      customer: { full_name: string | null; email: string | null } | null;
      client: { name: string } | null;
    } | null;
  };
  const rows = (subOrders ?? []) as unknown as Row[];

  const cards: SubOrderCardData[] = rows.map((row) => ({
    id: row.id,
    status: row.status as SubOrderStatus,
    claimedBy: row.claimed_by,
    createdAt: row.created_at,
    productName: row.order_line?.product?.name ?? "Unknown product",
    quantity: row.order_line?.quantity ?? 0,
    configuration: (row.order_line?.configuration as Record<string, string | string[]>) ?? {},
    customerName: row.order?.customer?.full_name ?? row.order?.client?.name ?? null,
    customerEmail: row.order?.customer?.email ?? null,
    artworkCount: row.order_line?.artwork_files?.length ?? 0,
    poNumber: row.order?.payment_method === "po" ? row.order?.po_number ?? "PO" : null,
  }));

  const columns = STATUS_ORDER.map((status) => ({
    status,
    items: cards.filter((c) => c.status === status),
  }));

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-[960px] px-6 py-10">
        {noImageCount ? (
          <Link
            href="/admin/product-images?supplier=all&empty=1"
            className="mb-6 block rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
          >
            {noImageCount} {noImageCount === 1 ? "product is" : "products are"} hidden from the website because{" "}
            {noImageCount === 1 ? "it has" : "they have"} no image. Add images →
          </Link>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
              ← BRANDSource
            </Link>
            <h1 className="mt-2 text-2xl font-semibold">Team dashboard</h1>
            {firstName ? <p className="mt-1 text-sm text-zinc-500">Hi {firstName}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/admin/clients" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Clients
            </Link>
            <Link href="/admin/orders" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Overview
            </Link>
            <Link href="/admin/categories" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Categories
            </Link>
            <Link href="/admin/suppliers" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Suppliers
            </Link>
            <Link href="/admin/hero" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Hero images
            </Link>
            <Link href="/admin/product-images" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Product images
            </Link>
            <Link href="/admin/xero" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Xero
            </Link>
            <Link href="/admin/errors" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Errors
            </Link>
            <Link
              href="/admin/orders/new"
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              + New PO order
            </Link>
            <p className="text-sm text-zinc-500">{cards.length} open order lines</p>
          </div>
        </div>

        <div className="mt-8 flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <div key={col.status} className="w-72 flex-shrink-0">
              <h2 className="mb-2 text-sm font-semibold text-zinc-700">
                {STATUS_LABEL[col.status]}{" "}
                <span className="font-normal text-zinc-400">({col.items.length})</span>
              </h2>
              <ul className="space-y-3">
                {col.items.map((item) => (
                  <SubOrderCard
                    key={item.id}
                    subOrder={item}
                    staff={staff ?? []}
                    onUpdateStatus={updateSubOrderStatus}
                    onClaim={claimSubOrder}
                  />
                ))}
                {col.items.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-zinc-200 p-3 text-xs text-zinc-400">
                    Nothing here
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
