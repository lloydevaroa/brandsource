"use client";

import { useMemo, useState } from "react";
import {
  buildFilterModel,
  factKey,
  groupOfKey,
  matchesSelection,
} from "@/lib/category-filters";
import { applyTierDiscount } from "@/lib/pricing";
import type { MasterCategory, MasterRow } from "@/lib/master-data";

type Tier = { name: string; discount_percent: number };

export type MasterState = {
  q: string;
  cat: string;
  sup: string;
  av: string;
  vis: string;
  sort: SortKey;
  dir: "asc" | "desc";
  f: string[];
};

type SortKey = "name" | "supplier" | "availability" | "moq" | "cost" | "rrp" | "markup" | "visibility";

const AVAILABILITY_LABEL: Record<MasterRow["availability"], string> = {
  stock: "Stock",
  indent: "Made to order",
  unknown: "Not recorded",
};
const AVAILABILITY_STYLE: Record<MasterRow["availability"], string> = {
  stock: "bg-emerald-100 text-emerald-800",
  indent: "bg-sky-100 text-sky-800",
  unknown: "bg-zinc-100 text-zinc-500",
};
const VISIBILITY_LABEL: Record<MasterRow["visibility"], string> = {
  live: "Live",
  sample: "Live (sample)",
  hidden: "Hidden",
};
const VISIBILITY_STYLE: Record<MasterRow["visibility"], string> = {
  live: "bg-emerald-100 text-emerald-800",
  sample: "bg-amber-100 text-amber-800",
  hidden: "bg-zinc-200 text-zinc-700",
};

const money = (n: number | null) => (n === null ? "—" : `$${n.toFixed(2)}`);
const markupOf = (r: MasterRow) => (r.rrp !== null && r.cost ? (r.rrp - r.cost) / r.cost : null);

const control = "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm";

export function MasterDataBrowser({
  rows,
  categories,
  tiers,
  suppliers,
  initial,
  noCostTables,
}: {
  rows: MasterRow[];
  categories: MasterCategory[];
  tiers: Tier[];
  suppliers: { slug: string; name: string }[];
  initial: MasterState;
  noCostTables: boolean;
}) {
  const [state, setState] = useState<MasterState>(initial);
  const [showTiers, setShowTiers] = useState(true);

  // Tiers other than Retail, best discount last so the columns read Bronze to Platinum.
  const discountTiers = useMemo(
    () => tiers.filter((t) => t.discount_percent > 0).sort((a, b) => a.discount_percent - b.discount_percent),
    [tiers],
  );

  const topLevel = useMemo(() => categories.filter((c) => !c.parent_slug && c.active), [categories]);
  const nameOf = useMemo(() => new Map(categories.map((c) => [c.slug, c.name])), [categories]);
  const selectedCategory = categories.find((c) => c.slug === state.cat) ?? null;
  const children = useMemo(
    () => (selectedCategory ? categories.filter((c) => c.parent_slug === selectedCategory.slug && c.active) : []),
    [categories, selectedCategory],
  );

  function update(patch: Partial<MasterState>) {
    const next = { ...state, ...patch };
    setState(next);
    const p = new URLSearchParams();
    if (next.q) p.set("q", next.q);
    if (next.cat) p.set("cat", next.cat);
    if (next.sup) p.set("sup", next.sup);
    if (next.av) p.set("av", next.av);
    if (next.vis) p.set("vis", next.vis);
    if (next.sort !== "name" || next.dir !== "asc") {
      p.set("sort", next.sort);
      p.set("dir", next.dir);
    }
    for (const k of next.f) p.append("f", k);
    const qs = p.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }

  // Products the left-hand filters work over: everything in the chosen category, ignoring the top bar.
  const scope = useMemo(
    () => (state.cat ? rows.filter((r) => r.categories.includes(state.cat) || children.some((c) => r.categories.includes(c.slug))) : []),
    [rows, state.cat, children],
  );

  const model = useMemo(
    () =>
      buildFilterModel(
        scope.map((r) => ({
          slug: r.slug,
          unit_price: r.rrp,
          categories: r.categories,
          specs: r.specs,
        })),
        children.map((c) => ({ slug: c.slug, name: c.name })),
      ),
    [scope, children],
  );

  const validKeys = useMemo(
    () => new Set(model.groups.flatMap((g) => g.options.map((o) => factKey(g.id, o.id)))),
    [model],
  );
  const selected = state.f.filter((k) => validKeys.has(k));

  const needle = state.q.trim().toLowerCase();
  const topBarMatch = (r: MasterRow) =>
    (!needle || r.name.toLowerCase().includes(needle) || r.slug.toLowerCase().includes(needle)) &&
    (!state.sup || r.supplierSlug === state.sup) &&
    (!state.av || r.availability === state.av) &&
    (!state.vis || (state.vis === "live" ? r.visibility !== "hidden" : r.visibility === state.vis));

  const shown = useMemo(() => {
    const list = (state.cat ? scope : rows).filter(topBarMatch).filter((r) => matchesSelection(model.facts[r.slug], selected));
    const dir = state.dir === "asc" ? 1 : -1;
    const value = (r: MasterRow): string | number | null => {
      switch (state.sort) {
        case "name": return r.name.toLowerCase();
        case "supplier": return r.supplier.toLowerCase();
        case "availability": return AVAILABILITY_LABEL[r.availability];
        case "moq": return r.moq;
        case "cost": return r.cost;
        case "rrp": return r.rrp;
        case "markup": return markupOf(r);
        case "visibility": return VISIBILITY_LABEL[r.visibility];
      }
    };
    return [...list].sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      if (x === null && y === null) return a.name.localeCompare(b.name);
      if (x === null) return 1; // blanks always last
      if (y === null) return -1;
      if (x < y) return -dir;
      if (x > y) return dir;
      return a.name.localeCompare(b.name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, scope, model, selected, state]);

  /** How many products an option would give with every other filter applied. */
  function countFor(groupId: string, key: string) {
    const others = selected.filter((k) => groupOfKey(k) !== groupId);
    return scope.filter(
      (r) => topBarMatch(r) && model.facts[r.slug]?.includes(key) && matchesSelection(model.facts[r.slug], others),
    ).length;
  }

  const toggle = (key: string) =>
    update({ f: selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key] });

  const filtering = Boolean(state.q || state.cat || state.sup || state.av || state.vis || selected.length);

  function sortBy(key: SortKey) {
    update(state.sort === key ? { dir: state.dir === "asc" ? "desc" : "asc" } : { sort: key, dir: "asc" });
  }

  const th = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-zinc-500";
  const sortable = (key: SortKey, text: string, align = "text-left") => (
    <th className={`${th} ${align}`} aria-sort={state.sort === key ? (state.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => sortBy(key)} className="cursor-pointer font-semibold hover:text-zinc-900">
        {text}
        <span aria-hidden className="ml-1 text-zinc-400">
          {state.sort === key ? (state.dir === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );

  const chip = (active: boolean) =>
    `cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
      active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
    }`;

  return (
    <>
      {/* Master filter bar, across the top like Trends */}
      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={state.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Search product name"
            aria-label="Search product name"
            className={`${control} w-56`}
          />
          <select value={state.sup} onChange={(e) => update({ sup: e.target.value })} aria-label="Supplier" className={control}>
            <option value="">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={state.av} onChange={(e) => update({ av: e.target.value })} aria-label="Availability" className={control}>
            <option value="">Any availability</option>
            <option value="stock">Stock</option>
            <option value="indent">Made to order</option>
            <option value="unknown">Not recorded</option>
          </select>
          <select value={state.vis} onChange={(e) => update({ vis: e.target.value })} aria-label="Website visibility" className={control}>
            <option value="">Live and hidden</option>
            <option value="live">Live on website</option>
            <option value="sample">Sample badge only</option>
            <option value="hidden">Hidden from website</option>
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" checked={showTiers} onChange={(e) => setShowTiers(e.target.checked)} />
            Tier prices
          </label>
          {filtering ? (
            <button
              type="button"
              onClick={() => update({ q: "", cat: "", sup: "", av: "", vis: "", f: [] })}
              className="cursor-pointer text-sm font-medium text-orange-600 hover:underline"
            >
              Clear all
            </button>
          ) : null}
          <p aria-live="polite" className="ml-auto text-sm text-zinc-500">
            {filtering ? `${shown.length} of ${rows.length} products` : `${rows.length} products`}
          </p>
        </div>

        <ul className="mt-4 flex flex-wrap gap-2">
          <li>
            <button type="button" className={chip(!state.cat)} onClick={() => update({ cat: "", f: [] })}>
              All categories
            </button>
          </li>
          {topLevel.map((c) => (
            <li key={c.slug}>
              <button type="button" className={chip(state.cat === c.slug)} onClick={() => update({ cat: c.slug, f: [] })}>
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Filters for the chosen category, down the left */}
        {state.cat ? (
        <aside className="w-full shrink-0 lg:w-64">
          {model.groups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">
              {nameOf.get(state.cat)} has too few products to build filters from.
            </p>
          ) : (
            <div className="space-y-5 rounded-xl border border-zinc-200 bg-white p-4">
              <h2 className="text-sm font-semibold">{nameOf.get(state.cat)} filters</h2>
              {model.groups.map((g) => (
                <fieldset key={g.id}>
                  <legend className="w-full border-b border-zinc-200 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {g.label}
                  </legend>
                  <ul className="mt-2">
                    {g.options.map((o) => {
                      const key = factKey(g.id, o.id);
                      const checked = selected.includes(key);
                      const count = countFor(g.id, key);
                      const unavailable = count === 0 && !checked;
                      return (
                        <li key={o.id}>
                          <label
                            className={`flex items-start gap-2 py-0.5 text-sm ${
                              unavailable ? "cursor-not-allowed text-zinc-400" : "cursor-pointer text-zinc-700 hover:text-zinc-900"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={unavailable}
                              onChange={() => toggle(key)}
                              className="mt-0.5 h-4 w-4 shrink-0"
                            />
                            <span className="min-w-0">
                              {o.label} <span className="text-zinc-400">({count})</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              ))}
            </div>
          )}
        </aside>
        ) : null}

        <div className="min-w-0 flex-1">
          {noCostTables ? (
            <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              Supplier cost and availability are blank because <code>supabase/supplier-pricing.sql</code> has not been
              run on this database.
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>
                  <th className={th} aria-label="Image" />
                  {sortable("name", "Product")}
                  {sortable("supplier", "Supplier")}
                  <th className={th}>Categories</th>
                  {sortable("availability", "Availability")}
                  {sortable("moq", "MOQ", "text-right")}
                  {sortable("cost", "Cost", "text-right")}
                  {sortable("rrp", "RRP", "text-right")}
                  {sortable("markup", "Markup", "text-right")}
                  {showTiers
                    ? discountTiers.map((t) => (
                        <th key={t.name} className={`${th} text-right`}>
                          {t.name}
                          <span className="block font-normal text-zinc-400">{t.discount_percent}% off</span>
                        </th>
                      ))
                    : null}
                  {sortable("visibility", "Website")}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {shown.map((r) => {
                  const mk = markupOf(r);
                  return (
                    <tr key={r.slug} className="align-top hover:bg-zinc-50">
                      <td className="px-3 py-2">
                        {r.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.image} alt="" loading="lazy" className="h-10 w-10 rounded object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded bg-zinc-100" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <a href={`/products/${r.slug}`} className="font-medium text-zinc-900 hover:underline">
                          {r.name}
                        </a>
                        <p className="text-xs text-zinc-400">{r.slug}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-700">{r.supplier}</td>
                      <td className="px-3 py-2 text-xs text-zinc-600">
                        {r.categories.length > 0 ? (
                          r.categories.map((c) => nameOf.get(c) ?? c).join(", ")
                        ) : (
                          <span className="text-amber-700">None</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          title={r.availabilityDetail || undefined}
                          className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${AVAILABILITY_STYLE[r.availability]}`}
                        >
                          {AVAILABILITY_LABEL[r.availability]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.moq}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums" title={r.costQty ? `At ${r.costQty}+ units, ex GST` : undefined}>
                        {money(r.cost)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{money(r.rrp)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-600">
                        {mk === null ? "—" : `${Math.round(mk * 100)}%`}
                      </td>
                      {showTiers
                        ? discountTiers.map((t) => (
                            <td key={t.name} className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-600">
                              {r.rrp === null ? "—" : money(applyTierDiscount(r.rrp, t.discount_percent))}
                            </td>
                          ))
                        : null}
                      <td className="px-3 py-2">
                        <span
                          title={r.visibilityNote}
                          className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${VISIBILITY_STYLE[r.visibility]}`}
                        >
                          {VISIBILITY_LABEL[r.visibility]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {shown.length === 0 ? (
              <p className="p-8 text-center text-sm text-zinc-500">No products match those filters.</p>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Prices are ex GST. Cost is the supplier price at the lowest quantity break (hover for the quantity).
            Availability is how the supplier prices the item: Stock, or made to order (Indent). Live stock counts
            are not synced yet.
          </p>
        </div>
      </div>
    </>
  );
}
