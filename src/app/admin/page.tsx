import Link from "next/link";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { createServiceSupabase } from "@/lib/supabase/server";
import { updateSubOrderStatus, claimSubOrder } from "./actions";
import { SubOrderCard, type SubOrderCardData } from "./SubOrderCard";
import { STATUS_ORDER, STATUS_LABEL } from "./status";
import type { SubOrderStatus } from "@/lib/types";

export default async function AdminPage() {
  const hasClerk =
    Boolean(process.env.CLERK_SECRET_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  if (!hasClerk) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Staff dashboard</h1>
        <p className="mt-2 text-zinc-600">
          Clerk is not configured on this deployment yet.
        </p>
      </div>
    );
  }

  const profile = await syncCurrentProfile();
  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Staff dashboard</h1>
        <p className="mt-2 text-zinc-600">
          <Link href="/sign-in" className="underline">
            Sign in
          </Link>{" "}
          to continue.
        </p>
      </div>
    );
  }
  if (profile.role !== "admin" && profile.role !== "manager") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Staff dashboard</h1>
        <p className="mt-2 text-zinc-600">
          Your account doesn&apos;t have staff access. Ask an admin to set your role in Clerk.
        </p>
      </div>
    );
  }

  const supabase = createServiceSupabase();

  const [{ data: subOrders, error }, { data: staff }] = await Promise.all([
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
          customer:profiles ( full_name, email )
        )
      `
      )
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["admin", "manager"])
      .order("full_name", { ascending: true }),
  ]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Staff dashboard</h1>
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
      customer: { full_name: string | null; email: string | null } | null;
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
    customerName: row.order?.customer?.full_name ?? null,
    customerEmail: row.order?.customer?.email ?? null,
    artworkCount: row.order_line?.artwork_files?.length ?? 0,
  }));

  const columns = STATUS_ORDER.map((status) => ({
    status,
    items: cards.filter((c) => c.status === status),
  }));

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
              ← BRANDSource
            </Link>
            <h1 className="mt-2 text-2xl font-semibold">Staff dashboard</h1>
          </div>
          <p className="text-sm text-zinc-500">{cards.length} open order lines</p>
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
