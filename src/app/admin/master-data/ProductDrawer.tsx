"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { applyTierDiscount } from "@/lib/pricing";
import type { FieldOverride, MasterCategory, MasterRow, OverrideField } from "@/lib/master-data";
import {
  getProductHistory,
  keepMyEdit,
  revertToSupplier,
  saveProductEdit,
  type HistoryEntry,
  type SaveResult,
} from "./actions";

type Tier = { name: string; discount_percent: number };

const MIN_MARKUP = 0.5; // README: prices are cost plus 50%

const FIELD_LABEL: Record<OverrideField, string> = { description: "Description", rrp: "RRP", categories: "Categories" };
const money = (n: number | null) => (n === null ? "—" : `$${n.toFixed(2)}`);
const when = (iso: string) =>
  new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

type Props = {
  row: MasterRow;
  categories: MasterCategory[];
  tiers: Tier[];
  canEdit: boolean;
  onClose: () => void;
  onResult: (r: SaveResult) => void;
};

export function ProductDrawer(props: Props) {
  // Remount whenever the live values change (after a save or revert) so the draft starts from what is now live.
  const { row } = props;
  const liveKey = `${row.slug}|${row.description}|${row.rrp}|${[...row.categories].sort().join(",")}|${Object.keys(row.overrides).join(",")}`;
  // These two survive the remount so a save doesn't collapse the history or lose the confirmation line.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const onResult = (r: SaveResult) => {
    setConfirmation(r.ok ? `${r.message} (${when(new Date().toISOString())})` : null);
    props.onResult(r);
  };
  return (
    <DrawerBody
      key={liveKey}
      {...props}
      onResult={onResult}
      historyOpen={historyOpen}
      setHistoryOpen={setHistoryOpen}
      confirmation={confirmation}
    />
  );
}

function DrawerBody({
  row,
  categories,
  tiers,
  canEdit,
  onClose,
  onResult,
  historyOpen,
  setHistoryOpen,
  confirmation,
}: Props & { historyOpen: boolean; setHistoryOpen: (v: boolean) => void; confirmation: string | null }) {
  const [description, setDescription] = useState(row.description);
  const [rrp, setRrp] = useState(row.rrp === null ? "" : row.rrp.toFixed(2));
  const [cats, setCats] = useState<string[]>(row.categories);
  const [catFilter, setCatFilter] = useState("");
  const [pending, start] = useTransition();
  const closeRef = useRef<HTMLButtonElement>(null);

  const nameOf = useMemo(() => new Map(categories.map((c) => [c.slug, c.name])), [categories]);
  const rrpNumber = rrp.trim() === "" ? null : Number(rrp);
  const rrpValid = rrpNumber !== null && Number.isFinite(rrpNumber) && rrpNumber > 0;

  const dirty = {
    description: description.trim() !== row.description.trim(),
    rrp: rrpValid ? Math.round(rrpNumber * 100) / 100 !== row.rrp : rrp.trim() !== (row.rrp === null ? "" : row.rrp.toFixed(2)),
    categories: !sameSet(cats, row.categories),
  };
  const dirtyFields = (Object.keys(dirty) as OverrideField[]).filter((f) => dirty[f]);
  const problem =
    dirty.description && !description.trim()
      ? "The description can't be empty."
      : dirty.rrp && !rrpValid
        ? "Enter the RRP as a price above $0, ex GST."
        : dirty.categories && cats.length === 0
          ? "Pick at least one category."
          : null;

  const guardedClose = () => {
    if (dirtyFields.length > 0 && !window.confirm("Close without saving your changes?")) return;
    onClose();
  };

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") guardedClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyFields.length]);

  function run(task: () => Promise<SaveResult>) {
    start(async () => {
      const result = await task();
      onResult(result);
    });
  }

  function save() {
    if (problem || dirtyFields.length === 0) return;
    run(() =>
      saveProductEdit({
        slug: row.slug,
        ...(dirty.description ? { description: description.trim() } : {}),
        ...(dirty.rrp && rrpNumber !== null ? { rrp: rrpNumber } : {}),
        ...(dirty.categories ? { categories: cats } : {}),
      }),
    );
  }

  const reviewFields = (Object.keys(row.overrides) as OverrideField[]).filter((f) => row.overrides[f]?.needsReview);
  const supplierDescription = (row.overrides.description?.supplierValue as string | null | undefined) ?? row.description;
  const supplierRrp = row.overrides.rrp ? (row.overrides.rrp.supplierValue as number | null) : row.rrp;
  const supplierCategories = row.overrides.categories
    ? ((row.overrides.categories.supplierValue as string[] | null) ?? [])
    : row.categories;

  const discountTiers = tiers.filter((t) => t.discount_percent > 0).sort((a, b) => a.discount_percent - b.discount_percent);
  const supplierMarkup = supplierRrp !== null && row.cost ? Math.round(((supplierRrp - row.cost) / row.cost) * 100) : null;
  const revertLabel: Record<OverrideField, string> = {
    description: "Revert to supplier description",
    categories: "Revert to supplier categories",
    rrp:
      supplierRrp === null
        ? "Revert to supplier price"
        : supplierMarkup === null
          ? `Revert to ${money(supplierRrp)}`
          : `Revert to ${supplierMarkup}% markup (${money(supplierRrp)})`,
  };
  const draftMarkup = rrpValid && row.cost ? (rrpNumber - row.cost) / row.cost : null;

  const topLevel = categories.filter((c) => !c.parent_slug && c.active);
  const needle = catFilter.trim().toLowerCase();
  const toggleCat = (slug: string) => setCats((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));

  const input = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-500";
  const sectionTitle = "text-sm font-semibold text-zinc-900";

  /** The supplier value beside the editable live value; one column for products with no supplier value. */
  const compare = (field: OverrideField, supplier: React.ReactNode, live: React.ReactNode) => {
    const o: FieldOverride | undefined = row.overrides[field];
    return (
      <section className="space-y-2 border-t border-zinc-200 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={sectionTitle}>{FIELD_LABEL[field]}</h3>
          {dirty[field] ? <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">Unsaved change</span> : null}
          {o ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-800">
              Edited{o.editedBy ? ` by ${o.editedBy}` : ""} {when(o.editedAt)}
            </span>
          ) : null}
        </div>
        <div className={row.isTrends ? "grid gap-3 sm:grid-cols-2" : ""}>
          {row.isTrends ? (
            <div className="rounded-lg bg-zinc-50 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Supplier (Trends)</p>
              {supplier}
            </div>
          ) : null}
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Live website</p>
            {live}
          </div>
        </div>
        {o && o.supplierValue !== null && canEdit ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => revertToSupplier(row.slug, field))}
            className="cursor-pointer text-sm font-medium text-orange-600 hover:underline disabled:opacity-50"
          >
            {revertLabel[field]}
          </button>
        ) : null}
      </section>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-zinc-900/40" onClick={guardedClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${row.name}`}
        className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
      >
        <header className="flex items-start gap-3 border-b border-zinc-200 p-5">
          {row.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.image} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
          ) : (
            <div className="h-14 w-14 shrink-0 rounded bg-zinc-100" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{row.name}</h2>
            <p className="text-xs text-zinc-500">
              {row.slug} · {row.supplier}
            </p>
            <a href={`/products/${row.slug}`} target="_blank" rel="noreferrer" className="text-xs text-zinc-500 underline hover:text-zinc-900">
              View on website
            </a>
          </div>
          <button ref={closeRef} type="button" onClick={guardedClose} className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:border-zinc-500">
            Close
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {!canEdit ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              Editing is switched off until <code>supabase/product-overrides.sql</code> has been run on this database.
            </p>
          ) : null}

          {reviewFields.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Trends has changed something you edited</p>
              {reviewFields.map((f) => (
                <div key={f} className="text-sm text-amber-900">
                  <p>
                    <strong>{FIELD_LABEL[f]}:</strong> {row.overrides[f]?.reviewNote ?? "The supplier now sends a different value."}
                  </p>
                  <div className="mt-1 flex gap-4">
                    <button type="button" disabled={pending} onClick={() => run(() => keepMyEdit(row.slug, f))} className="cursor-pointer font-medium underline disabled:opacity-50">
                      Keep my edit
                    </button>
                    <button type="button" disabled={pending} onClick={() => run(() => revertToSupplier(row.slug, f))} className="cursor-pointer font-medium underline disabled:opacity-50">
                      Use the supplier&apos;s new value
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {compare(
            "description",
            <p className="whitespace-pre-wrap text-sm text-zinc-700">{supplierDescription || "No description"}</p>,
            <>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                maxLength={1000}
                disabled={!canEdit}
                aria-label="Live website description"
                className={input}
              />
              <p className="mt-1 text-right text-xs text-zinc-400">{description.length} / 1,000</p>
            </>,
          )}

          {compare(
            "rrp",
            <p className="text-sm tabular-nums text-zinc-700">{money(supplierRrp)} <span className="text-zinc-400">ex GST</span></p>,
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={rrp}
                  onChange={(e) => setRrp(e.target.value)}
                  disabled={!canEdit}
                  aria-label="Live website RRP, ex GST"
                  className={`${input} max-w-40 tabular-nums`}
                />
                <span className="text-xs text-zinc-400">ex GST</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-600 sm:grid-cols-3">
                <div>
                  <dt className="text-zinc-400">Supplier cost</dt>
                  <dd className="tabular-nums">{money(row.cost)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Markup</dt>
                  <dd className="tabular-nums">{draftMarkup === null ? "—" : `${Math.round(draftMarkup * 100)}%`}</dd>
                </div>
                {discountTiers.map((t) => (
                  <div key={t.name}>
                    <dt className="text-zinc-400">
                      {t.name} ({t.discount_percent}% off)
                    </dt>
                    <dd className="tabular-nums">{rrpValid ? money(applyTierDiscount(rrpNumber, t.discount_percent)) : "—"}</dd>
                  </div>
                ))}
              </dl>
              {draftMarkup !== null && rrpValid && rrpNumber < (row.cost ?? 0) ? (
                <p className="mt-2 text-xs font-medium text-red-700">This is below the supplier cost.</p>
              ) : draftMarkup !== null && draftMarkup < MIN_MARKUP - 0.005 ? (
                <p className="mt-2 text-xs text-amber-700">Markup is under the usual 50%.</p>
              ) : null}
            </>,
          )}

          {compare(
            "categories",
            <p className="text-sm text-zinc-700">
              {supplierCategories.length ? supplierCategories.map((c) => nameOf.get(c) ?? c).join(", ") : "None"}
            </p>,
            <>
              {cats.length > 0 ? (
                <ul className="mb-2 flex flex-wrap gap-1.5">
                  {cats.map((c) => (
                    <li key={c}>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => toggleCat(c)}
                        title="Remove"
                        className="cursor-pointer rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-0.5 text-xs hover:border-zinc-500"
                      >
                        {nameOf.get(c) ?? c} <span aria-hidden>×</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-2 text-xs text-amber-700">No category: the website leaves the product out.</p>
              )}
              <input
                type="search"
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                placeholder="Find a category"
                aria-label="Find a category"
                disabled={!canEdit}
                className={input}
              />
              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-zinc-200 p-2">
                {topLevel.map((parent) => {
                  const kids = categories.filter((c) => c.parent_slug === parent.slug && c.active);
                  const items = [parent, ...kids].filter((c) => !needle || c.name.toLowerCase().includes(needle));
                  if (items.length === 0) return null;
                  return (
                    <div key={parent.slug} className="mb-1.5">
                      {items.map((c) => (
                        <label key={c.slug} className={`flex cursor-pointer items-center gap-2 py-0.5 text-sm text-zinc-700 ${c.parent_slug ? "pl-5" : "font-medium"}`}>
                          <input type="checkbox" checked={cats.includes(c.slug)} disabled={!canEdit} onChange={() => toggleCat(c.slug)} className="h-4 w-4" />
                          {c.name}
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>,
          )}

          <HistorySection slug={row.slug} categories={nameOf} open={historyOpen} setOpen={setHistoryOpen} refreshKey={confirmation ?? ""} />
        </div>

        <footer className="border-t border-zinc-200 bg-zinc-50 p-4">
          {problem ? <p className="mb-2 text-sm text-red-700">{problem}</p> : null}
          {confirmation && !problem ? (
            <p role="status" className="mb-2 text-sm text-emerald-700">
              ✓ {confirmation}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={!canEdit || pending || dirtyFields.length === 0 || problem !== null}
              className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {pending ? "Saving…" : dirtyFields.length > 0 ? `Save ${dirtyFields.length === 1 ? FIELD_LABEL[dirtyFields[0]].toLowerCase() : `${dirtyFields.length} changes`}` : "Save changes"}
            </button>
            {dirtyFields.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setDescription(row.description);
                  setRrp(row.rrp === null ? "" : row.rrp.toFixed(2));
                  setCats(row.categories);
                }}
                className="cursor-pointer text-sm text-zinc-600 hover:text-zinc-900"
              >
                Discard changes
              </button>
            ) : null}
            <p className="ml-auto text-xs text-zinc-500">Edits go live straight away and are logged.</p>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function formatValue(field: OverrideField, v: HistoryEntry["oldValue"], nameOf: Map<string, string>) {
  if (v === null || v === undefined) return "—";
  if (field === "rrp") return money(Number(v));
  if (field === "categories") return Array.isArray(v) ? v.map((s) => nameOf.get(s) ?? s).join(", ") || "None" : String(v);
  const text = String(v);
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

const KIND_LABEL: Record<HistoryEntry["kind"], string> = {
  edit: "edited",
  revert: "reverted to the supplier value",
  keep: "kept their edit",
  supplier_change: "supplier changed",
};

function HistorySection({
  slug,
  categories,
  open,
  setOpen,
  refreshKey,
}: {
  slug: string;
  categories: Map<string, string>;
  open: boolean;
  setOpen: (v: boolean) => void;
  refreshKey: string;
}) {
  const [state, setState] = useState<{ entries: HistoryEntry[] } | { error: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    getProductHistory(slug).then((r) => {
      if (live) setState(r.ok ? { entries: r.entries } : { error: r.message });
    });
    return () => {
      live = false;
    };
  }, [open, slug, refreshKey]);

  return (
    <section className="border-t border-zinc-200 pt-4">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="cursor-pointer text-sm font-semibold text-zinc-900">
        Change history <span aria-hidden className="text-zinc-400">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="mt-2 text-sm">
          {!state ? (
            <p className="text-zinc-500">Loading…</p>
          ) : "error" in state ? (
            <p className="text-zinc-500">{state.error}</p>
          ) : state.entries.length === 0 ? (
            <p className="text-zinc-500">No changes recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {state.entries.map((e, i) => (
                <li key={i} className="text-zinc-700">
                  <p className="text-xs text-zinc-500">
                    {when(e.at)} · {e.by} {KIND_LABEL[e.kind]} · {FIELD_LABEL[e.field]}
                  </p>
                  {e.kind === "keep" ? null : (
                    <p className="mt-0.5 text-xs">
                      <span className="text-zinc-400 line-through">{formatValue(e.field, e.oldValue, categories)}</span>{" "}
                      <span aria-hidden>→</span> {formatValue(e.field, e.newValue, categories)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
