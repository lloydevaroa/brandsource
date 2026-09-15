import Link from "next/link";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { createServiceSupabase } from "@/lib/supabase/server";

const STATUS_LABEL: Record<string, string> = {
  new_order: "Received",
  payment_received: "Payment received",
  artwork_required: "Artwork needed",
  proof_awaiting_approval: "Awaiting your approval",
  ready_to_order: "Ready to order",
  sent_to_supplier: "Sent to supplier",
  in_production: "In production",
  dispatched: "Dispatched",
  completed: "Completed",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const { paid } = await searchParams;
  const hasClerk =
    Boolean(process.env.CLERK_SECRET_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  if (!hasClerk) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Home
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Your account</h1>
        <p className="mt-2 text-zinc-600">
          Clerk is not fully configured on this deployment yet (missing
          CLERK_SECRET_KEY and/or publishable key in Vercel env).
        </p>
      </div>
    );
  }

  const { currentUser } = await import("@clerk/nextjs/server");
  const user = await currentUser();
  const profile = await syncCurrentProfile();

  const supabase = createServiceSupabase();
  const { data: orders } = profile
    ? await supabase
        .from("orders")
        .select(
          "id, status, created_at, order_lines(id, quantity, product_id, sub_orders(status))"
        )
        .eq("customer_id", profile.id)
        .neq("status", "draft")
        .order("created_at", { ascending: false })
    : { data: null };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Home
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Your account</h1>
      <p className="mt-2 text-zinc-600">
        Signed in as {user?.primaryEmailAddress?.emailAddress ?? profile?.clerk_user_id}.
      </p>

      {paid ? (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Payment received — thanks! We&apos;ll proof your artwork and be in touch before
          production starts.
        </div>
      ) : null}

      <h2 className="mt-8 text-lg font-semibold">Your orders</h2>
      {!orders || orders.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">
          Nothing here yet.{" "}
          <Link href="/#products" className="underline underline-offset-2">
            Browse Trade Show products
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {orders.map((order) => {
            const lineCount = order.order_lines?.length ?? 0;
            const statuses = new Set(
              order.order_lines?.flatMap((l) =>
                (l.sub_orders ?? []).map((s) => s.status)
              ) ?? []
            );
            const statusLabel =
              statuses.size === 0
                ? "Processing payment"
                : statuses.size === 1
                  ? STATUS_LABEL[[...statuses][0]] ?? [...statuses][0]
                  : "In progress";
            return (
              <li
                key={order.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    Order #{order.id.slice(0, 8)} · {lineCount} item{lineCount === 1 ? "" : "s"}
                  </span>
                  <span className="text-zinc-500">{statusLabel}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  Submitted {new Date(order.created_at).toLocaleDateString("en-NZ")}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
