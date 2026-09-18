import Link from "next/link";
import { createServiceSupabase } from "@/lib/supabase/server";
import { requireStaffProfile } from "../staff-guard";
import type { OrderStatus, OrderPaymentMethod, SubOrderStatus } from "@/lib/types";

const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Draft",
  new_order: "New",
  in_production: "In production",
  completed: "Completed",
  invoiced: "Invoiced",
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  draft: "bg-zinc-100 text-zinc-500",
  new_order: "bg-blue-50 text-blue-700",
  in_production: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  invoiced: "bg-violet-50 text-violet-700",
};

function formatNZD(amount: number | null) {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(amount);
}

export default async function OrdersOverviewPage() {
  const staffResult = await requireStaffProfile("Order status overview");
  if ("guard" in staffResult) return staffResult.guard;

  const supabase = createServiceSupabase();
  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      po_number,
      payment_method,
      status,
      total_amount,
      created_at,
      customer:profiles!orders_customer_id_fkey ( full_name, email ),
      client:clients ( name ),
      sub_orders ( status )
    `
    )
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Order status overview</h1>
        <p className="mt-2 text-red-600">Could not load orders: {error.message}</p>
      </div>
    );
  }

  // Same to-one embed cardinality caveat as admin/page.tsx.
  type Row = {
    id: string;
    po_number: string | null;
    payment_method: OrderPaymentMethod;
    status: OrderStatus;
    total_amount: number | null;
    created_at: string;
    customer: { full_name: string | null; email: string | null } | null;
    client: { name: string } | null;
    sub_orders: { status: SubOrderStatus }[];
  };
  const rows = (orders ?? []) as unknown as Row[];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Staff dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Order status overview</h1>
        <p className="mt-2 text-sm text-zinc-500">
          One row per order, rolled up from its sub-orders — for line-by-line detail and to
          change status, use the{" "}
          <Link href="/admin" className="underline underline-offset-2">
            Kanban board
          </Link>
          .
        </p>

        <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Client / customer</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const completedCount = row.sub_orders.filter((s) => s.status === "completed").length;
                return (
                  <tr key={row.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3">
                      {row.client?.name ?? row.customer?.full_name ?? row.customer?.email ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {row.payment_method === "po" ? row.po_number || "PO (no ref)" : "Card"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[row.status]}`}
                      >
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {completedCount}/{row.sub_orders.length} sub-orders complete
                    </td>
                    <td className="px-4 py-3">{formatNZD(row.total_amount)}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(row.created_at).toLocaleDateString("en-NZ")}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-zinc-400">
                    No orders yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
