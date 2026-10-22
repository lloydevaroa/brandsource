"use client";

import { useRef, useState, useTransition } from "react";
import { parseCsv, toCsv } from "@/lib/csv";
import type { MasterCategory, MasterRow, OverrideField } from "@/lib/master-data";
import type { CsvRow, PlanItem } from "@/lib/product-csv";
import { applyCsvEdits, previewCsvEdits, type SaveResult } from "./actions";

const EDITABLE = ["description", "categories", "rrp"] as const;
const HEADERS = [
  "slug",
  "name",
  "supplier",
  "cost (read only)",
  "supplier_description (read only)",
  "website_description",
  "supplier_categories (read only)",
  "Categories (separated by | )",
  "supplier_rrp (read only)",
  "rrp",
];
// Headers are matched on their name alone: capitals and anything in brackets are ignored, and the
// old "description" name still works for files saved before the rename.
const HEADER_ALIASES: Record<(typeof EDITABLE)[number] | "slug", string[]> = {
  slug: ["slug"],
  description: ["website_description", "description"],
  categories: ["categories"],
  rrp: ["rrp"],
};
// Only the example file carries a notes column, with the rules written out beside real rows.
const MAX_APPLY = 300;
const MAX_SHOWN = 100;

const FIELD_LABEL: Record<OverrideField, string> = { description: "Description", rrp: "RRP", categories: "Categories" };
const money = (n: number | null) => (n === null ? "—" : `$${n.toFixed(2)}`);

function download(filename: string, rows: string[][]) {
  // The byte order mark makes Excel read accents and symbols correctly.
  const blob = new Blob([`﻿${toCsv(rows)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CsvTools({
  rows,
  shown,
  categories,
  canEdit,
  onResult,
}: {
  rows: MasterRow[];
  shown: MasterRow[];
  categories: MasterCategory[];
  canEdit: boolean;
  onResult: (r: SaveResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<CsvRow[] | null>(null);
  const [items, setItems] = useState<PlanItem[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const catName = new Map(categories.map((c) => [c.slug, c.name]));
  // A name that two categories share is exported as the slug, so the file always reads back unambiguously.
  const nameCount = new Map<string, number>();
  for (const c of categories) nameCount.set(c.name.toLowerCase(), (nameCount.get(c.name.toLowerCase()) ?? 0) + 1);
  const catToken = (slug: string) => {
    const name = catName.get(slug);
    return name && nameCount.get(name.toLowerCase()) === 1 ? name : slug;
  };

  const sheetRow = (r: MasterRow, notes?: string): string[] => {
    const supDesc = r.overrides.description ? ((r.overrides.description.supplierValue as string | null) ?? "") : r.isTrends ? r.description : "";
    const supCats = r.overrides.categories ? ((r.overrides.categories.supplierValue as string[] | null) ?? []) : r.isTrends ? r.categories : [];
    const supRrp = r.overrides.rrp ? (r.overrides.rrp.supplierValue as number | null) : r.isTrends ? r.rrp : null;
    return [
      r.slug,
      r.name,
      r.supplier,
      r.cost === null ? "" : r.cost.toFixed(2),
      supDesc,
      r.description,
      supCats.map(catToken).join(" | "),
      r.categories.map(catToken).join(" | "),
      supRrp === null ? "" : supRrp.toFixed(2),
      r.rrp === null ? "" : r.rrp.toFixed(2),
      ...(notes === undefined ? [] : [notes]),
    ];
  };

  function downloadExample() {
    // Real products with their current values, so uploading the example unchanged changes nothing.
    const step = Math.max(1, Math.floor(rows.length / 8));
    const picks = Array.from({ length: Math.min(8, rows.length) }, (_, i) => rows[i * step]);
    const notes = [
      "Only website_description, Categories and rrp are read. Columns marked (read only) are for reference: the supplier's own data is never changed by an upload.",
      "Change a cell to change that product. Leave it as it is, or empty, for no change.",
      "Separate categories with | and use the category name, e.g. Bags | Tote Bags.",
      "Type [supplier] in a cell to put the supplier's value back (Trends products).",
      "rrp is the price ex GST, e.g. 12.95.",
      "Keep the slug exactly as it is: it is how a row finds its product.",
    ];
    download("master-data-example-format.csv", [[...HEADERS, "notes"], ...picks.map((r, i) => sheetRow(r, notes[i] ?? ""))]);
  }

  const exportView = () =>
    download(`master-data-${new Date().toISOString().slice(0, 10)}.csv`, [HEADERS, ...shown.map((r) => sheetRow(r))]);

  function reset() {
    setFileName("");
    setParsed(null);
    setItems(null);
    setProblem(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    setFileName(file.name);
    const table = parseCsv(await file.text()).filter((r) => r.some((c) => c.trim() !== ""));
    if (table.length < 2) return setProblem("That file has no product rows. Start from the example format.");
    const head = table[0].map((h) => h.trim().toLowerCase().replace(/\s*\(.*\)\s*$/, ""));
    const col = (name: keyof typeof HEADER_ALIASES) => {
      const i = HEADER_ALIASES[name].map((a) => head.indexOf(a)).find((x) => x !== -1);
      return i ?? -1;
    };
    if (col("slug") === -1) return setProblem('There is no "slug" column. Start from the example format or an export.');
    if (!EDITABLE.some((c) => col(c) !== -1)) return setProblem("There is no website_description, Categories or rrp column to read.");

    const out: CsvRow[] = table.slice(1).map((cells, i) => {
      const get = (name: (typeof EDITABLE)[number]) => {
        const v = col(name) === -1 ? "" : (cells[col(name)] ?? "");
        return v.trim() === "" ? undefined : v;
      };
      return { line: i + 2, slug: (cells[col("slug")] ?? "").trim(), description: get("description"), categories: get("categories"), rrp: get("rrp") };
    });
    setParsed(out);
    start(async () => {
      const r = await previewCsvEdits(out);
      if (r.ok) setItems(r.items);
      else setProblem(r.message);
    });
  }

  const changing = items?.filter((i) => i.errors.length === 0 && i.changes.length > 0) ?? [];
  const errored = items?.filter((i) => i.errors.length > 0) ?? [];
  const warned = items?.filter((i) => i.warnings.length > 0 && i.errors.length === 0 && i.changes.length > 0) ?? [];
  const fieldCount = changing.reduce((n, i) => n + i.changes.length, 0);
  const unchanged = (items?.length ?? 0) - changing.length - errored.length;

  function apply() {
    if (!parsed) return;
    start(async () => {
      const r = await applyCsvEdits(parsed);
      onResult(r);
      if (r.ok) {
        setOpen(false);
        reset();
      } else setItems(null); // the file is stale after a partial failure: re-upload to see what is left
    });
  }

  const fmt = (field: OverrideField, v: PlanItem["changes"][number]["to"]) => {
    if (v === null) return "—";
    if (field === "rrp") return money(Number(v));
    if (field === "categories") return (v as string[]).map((s) => catName.get(s) ?? s).join(", ") || "None";
    const t = String(v);
    return t.length > 110 ? `${t.slice(0, 110)}…` : t;
  };

  const btn = "cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn}>
        Bulk edit (CSV)
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
          <div className="fixed inset-0 bg-zinc-900/40" onClick={() => setOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="Bulk edit with a CSV file" className="relative w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold">Bulk edit with a CSV file</h2>
              <button type="button" onClick={() => setOpen(false)} className={btn}>
                Close
              </button>
            </div>

            <ol className="mt-4 space-y-5 text-sm text-zinc-700">
              <li>
                <p className="font-semibold text-zinc-900">1. Get a file to start from</p>
                <p className="mt-1 text-zinc-600">
                  The example shows the format with a few real products. Their values are unchanged, so uploading it as it is changes nothing.
                  The export has every product in the current view ({shown.length}) with the supplier&apos;s value beside yours. Pro tip - just import products that are to be updated
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button type="button" onClick={downloadExample} disabled={rows.length === 0} className={btn}>
                    Download example format
                  </button>
                  <button type="button" onClick={exportView} disabled={shown.length === 0} className={btn}>
                    Export current view ({shown.length})
                  </button>
                </div>
              </li>
              <li>
                <p className="font-semibold text-zinc-900">2. Edit it in Excel or Google Sheets</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-zinc-600">
                  <li>Only <strong>website_description</strong>, <strong>Categories</strong> and <strong>rrp</strong> are read. Columns marked (read only) are the supplier&apos;s own data and are never changed. Keep the <strong>slug</strong> as it is.</li>
                  <li>Empty or unchanged cell: no change. Separate categories with <code>|</code>.</li>
                  <li>Type <code>[supplier]</code> in a cell to go back to the supplier&apos;s value.</li>
                </ul>
              </li>
              <li>
                <p className="font-semibold text-zinc-900">3. Upload it and check what will change</p>
                <p className="mt-1 text-zinc-600">Nothing is saved until you press Apply.</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    disabled={!canEdit || pending}
                    onChange={(e) => onFile(e.target.files?.[0])}
                    aria-label="Choose a CSV file"
                    className="text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-zinc-300 file:bg-white file:px-3 file:py-2 file:text-sm"
                  />
                  {fileName ? <span className="text-xs text-zinc-500">{fileName}</span> : null}
                </div>
                {!canEdit ? <p className="mt-2 text-amber-800">Editing is switched off until the database step has been run.</p> : null}
              </li>
            </ol>

            {pending && !items ? <p className="mt-5 text-sm text-zinc-500">Checking the file…</p> : null}
            {problem ? <p role="alert" className="mt-5 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-900">{problem}</p> : null}

            {items ? (
              <div className="mt-6 border-t border-zinc-200 pt-5">
                <p aria-live="polite" className="flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">{changing.length} will change</span>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">{unchanged} unchanged</span>
                  {errored.length ? <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">{errored.length} with errors</span> : null}
                  {warned.length ? <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">{warned.length} to double-check</span> : null}
                </p>

                {errored.length ? (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-red-800">These rows will be skipped. Fix them and upload again, or apply the rest.</p>
                    <ul className="mt-1 space-y-1 text-sm text-red-900">
                      {errored.slice(0, MAX_SHOWN).map((i) => (
                        <li key={i.line}>
                          <span className="font-medium">Line {i.line}{i.name !== i.slug ? `, ${i.name}` : i.slug ? `, ${i.slug}` : ""}:</span> {i.errors.join(" ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {changing.length ? (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-zinc-900">Changes</p>
                    <ul className="mt-1 max-h-96 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200">
                      {changing.slice(0, MAX_SHOWN).map((i) => (
                        <li key={i.line} className="px-3 py-2 text-sm">
                          <p className="font-medium text-zinc-900">
                            {i.name} <span className="text-xs font-normal text-zinc-400">line {i.line}</span>
                          </p>
                          {i.changes.map((c) => (
                            <p key={c.field} className="mt-0.5 text-xs text-zinc-700">
                              <span className="font-medium">{FIELD_LABEL[c.field]}{c.kind === "revert" ? " (back to supplier)" : ""}:</span>{" "}
                              <span className="text-zinc-400 line-through">{fmt(c.field, c.from)}</span> <span aria-hidden>→</span> {fmt(c.field, c.to)}
                            </p>
                          ))}
                          {i.warnings.map((w) => (
                            <p key={w} className="mt-0.5 text-xs text-amber-700">{w}</p>
                          ))}
                        </li>
                      ))}
                    </ul>
                    {changing.length > MAX_SHOWN ? <p className="mt-1 text-xs text-zinc-500">…and {changing.length - MAX_SHOWN} more products, all included when you apply.</p> : null}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-zinc-600">Nothing in this file differs from what is live.</p>
                )}

                {changing.length > MAX_APPLY ? (
                  <p className="mt-3 text-sm text-red-800">That is more than {MAX_APPLY} products. Split the file and upload it in parts.</p>
                ) : null}

                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={apply}
                    disabled={pending || changing.length === 0 || changing.length > MAX_APPLY}
                    className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  >
                    {pending ? "Applying…" : `Apply ${fieldCount} change${fieldCount === 1 ? "" : "s"} to ${changing.length} product${changing.length === 1 ? "" : "s"}`}
                  </button>
                  <button type="button" onClick={reset} disabled={pending} className="cursor-pointer text-sm text-zinc-600 hover:text-zinc-900">
                    Choose a different file
                  </button>
                  <p className="ml-auto text-xs text-zinc-500">Changes go live straight away and are logged.</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
