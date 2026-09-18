import Link from "next/link";
import { createServiceSupabase } from "@/lib/supabase/server";
import { requireStaffProfile } from "../../staff-guard";
import { OrderBuilder } from "./OrderBuilder";

export default async function NewOrderPage() {
  const staffResult = await requireStaffProfile("New PO order");
  if ("guard" in staffResult) return staffResult.guard;

  const supabase = createServiceSupabase();
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("client_type", "managed")
    .order("name", { ascending: true });

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">New PO order</h1>
        <p className="mt-2 text-red-600">Could not load clients: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Staff dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New PO order</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Create an order on behalf of a managed client — no card payment, invoiced later via
          Xero on their credit terms.
        </p>

        <div className="mt-8">
          <OrderBuilder clients={clients ?? []} />
        </div>
      </div>
    </div>
  );
}
