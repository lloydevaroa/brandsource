import Link from "next/link";
import { createServiceSupabase } from "@/lib/supabase/server";
import { requireStaffProfile } from "../staff-guard";
import { NewClientForm } from "./NewClientForm";

export default async function ClientsPage() {
  const staffResult = await requireStaffProfile("Clients");
  if ("guard" in staffResult) return staffResult.guard;

  const supabase = createServiceSupabase();

  const [{ data: clients, error }, { data: staff }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, name, contact_email, credit_term_days, account_manager:profiles!clients_account_manager_id_fkey ( full_name )"
      )
      .eq("client_type", "managed")
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["admin", "manager"])
      .order("full_name", { ascending: true }),
  ]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="mt-2 text-red-600">Could not load clients: {error.message}</p>
      </div>
    );
  }

  // Same to-one embed cardinality caveat as admin/page.tsx.
  type ClientRow = {
    id: string;
    name: string;
    contact_email: string | null;
    credit_term_days: number | null;
    account_manager: { full_name: string | null } | null;
  };
  const rows = (clients ?? []) as unknown as ClientRow[];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Staff dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Managed clients</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Clients on account/credit terms, billed via Xero rather than card at order time.
        </p>

        <div className="mt-8">
          <NewClientForm staff={staff ?? []} />
        </div>

        <ul className="mt-6 space-y-2">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 text-sm"
            >
              <div>
                <span className="font-medium">{c.name}</span>
                {c.contact_email ? (
                  <span className="ml-2 text-xs text-zinc-400">{c.contact_email}</span>
                ) : (
                  <span className="ml-2 text-xs text-amber-600">no contact email — notifications won&apos;t send</span>
                )}
              </div>
              <span className="text-zinc-500">
                {c.account_manager?.full_name ?? "Unassigned"} · {c.credit_term_days ?? "—"} day terms
              </span>
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="rounded-lg border border-dashed border-zinc-200 p-3 text-xs text-zinc-400">
              No managed clients yet.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
