import Link from "next/link";
import { requireStaffProfile } from "../staff-guard";
import { createServiceSupabase } from "@/lib/supabase/server";
import { formatNzTime } from "@/lib/error-log";

export const dynamic = "force-dynamic";

export default async function ErrorsPage() {
  const staffResult = await requireStaffProfile("Errors");
  if ("guard" in staffResult) return staffResult.guard;

  const supabase = createServiceSupabase();
  const { data: errors, error } = await supabase
    .from("error_log")
    .select("id, occurred_at, area, summary, detail, staff:profiles ( email )")
    .order("occurred_at", { ascending: false })
    .limit(200);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Team dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Errors</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Failed order creations and Xero sends from the last 7 days, newest first. Older entries are removed
          automatically. The reference matches the one in the message staff were shown.
        </p>

        {error ? (
          <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load the error log: {error.message}. Has supabase/error-log.sql been run?
          </p>
        ) : !errors?.length ? (
          <p className="mt-6 text-sm text-zinc-500">No errors in the last 7 days.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {errors.map((e) => {
              const staff = e.staff as unknown as { email: string | null } | null;
              return (
                <li key={e.id} className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
                  <p className="text-xs text-zinc-500">
                    {formatNzTime(new Date(e.occurred_at))} · ref {e.id.slice(0, 8).toUpperCase()} · {e.area}
                    {staff?.email ? ` · ${staff.email}` : ""}
                  </p>
                  <p className="mt-1 font-medium">{e.summary}</p>
                  {e.detail ? (
                    <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-zinc-50 p-2 text-xs text-zinc-600">
                      {e.detail}
                    </pre>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
