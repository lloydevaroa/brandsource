import Link from "next/link";
import { getMasterData } from "@/lib/master-data";
import { requireStaffProfile } from "../staff-guard";
import { MasterDataBrowser, type MasterState } from "./MasterDataBrowser";

export const dynamic = "force-dynamic";

const SORTS = ["name", "supplier", "availability", "moq", "cost", "rrp", "markup", "visibility"] as const;

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function MasterDataPage({ searchParams }: { searchParams: Promise<Params> }) {
  const staffResult = await requireStaffProfile("Master data");
  if ("guard" in staffResult) return staffResult.guard;

  let data;
  try {
    data = await getMasterData();
  } catch (e) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Master data</h1>
        <p className="mt-2 text-red-600">{e instanceof Error ? e.message : "Could not load the catalogue."}</p>
      </div>
    );
  }

  const params = await searchParams;
  const sort = one(params.sort);
  const f = params.f === undefined ? [] : Array.isArray(params.f) ? params.f : [params.f];
  const initial: MasterState = {
    q: one(params.q),
    cat: one(params.cat),
    sup: one(params.sup),
    av: one(params.av),
    vis: one(params.vis),
    sort: (SORTS as readonly string[]).includes(sort) ? (sort as MasterState["sort"]) : "name",
    dir: one(params.dir) === "desc" ? "desc" : "asc",
    f,
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-[1500px] px-6 py-10">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Team dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Master data</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-500">
          Every product in one place for the management team to sort and check: category, supplier, availability,
          cost, selling price and the rate tier prices. This page is view only. Supplier cost is internal and never
          shown to customers. Pick a category to get that category&apos;s own filters down the left.
        </p>
        <MasterDataBrowser
          rows={data.rows}
          categories={data.categories}
          tiers={data.tiers.map((t) => ({ name: t.name, discount_percent: t.discount_percent }))}
          suppliers={data.suppliers}
          initial={initial}
          noCostTables={data.noCostTables}
        />
      </div>
    </div>
  );
}
