import Link from "next/link";
import { requireStaffProfile } from "../staff-guard";
import { getXeroConnection, isXeroConfigured } from "@/lib/xero";
import { disconnect } from "./actions";

const ERRORS: Record<string, string> = {
  not_configured: "Xero app keys aren't set in Vercel yet (XERO_CLIENT_ID / XERO_CLIENT_SECRET).",
  state_mismatch: "The connection attempt expired or didn't match. Try again.",
  connect_failed: "Xero accepted the login but the connection couldn't be saved. Check the Vercel logs.",
  access_denied: "Access wasn't granted in Xero.",
};

export default async function XeroPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const staffResult = await requireStaffProfile("Xero");
  if ("guard" in staffResult) return staffResult.guard;
  const { profile } = staffResult;

  const { connected, error } = await searchParams;
  const configured = isXeroConfigured();
  const connection = configured ? await getXeroConnection() : null;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Team dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Xero</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Completed purchase-order jobs are sent to Xero as draft invoices from the{" "}
          <Link href="/admin/orders" className="underline underline-offset-2">
            order overview
          </Link>
          . Xero sends the actual invoice to the client.
        </p>

        {connected ? (
          <p className="mt-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Xero connected.</p>
        ) : null}
        {error ? (
          <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {ERRORS[error] ?? `Xero returned: ${error}`}
          </p>
        ) : null}

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
          {!configured ? (
            <p className="text-sm text-zinc-600">
              Not set up yet: the Xero app keys need adding in Vercel before this can connect.
            </p>
          ) : connection ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-zinc-500">Connected to</p>
                <p className="font-medium">{connection.tenant_name ?? connection.tenant_id}</p>
              </div>
              {profile.role === "admin" ? (
                <form action={disconnect}>
                  <button className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:border-zinc-400">
                    Disconnect
                  </button>
                </form>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-zinc-600">Not connected. You&apos;ll need to be an admin in BrandSource&apos;s Xero.</p>
              {/* Plain <a>: this is an API route that redirects off-site to Xero. */}
              <a
                href="/api/xero/connect"
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Connect to Xero
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
