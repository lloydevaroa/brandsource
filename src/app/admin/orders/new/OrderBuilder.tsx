"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type KeyboardEvent } from "react";
import type { CatalogProduct } from "@/lib/catalog";
import { applyTierDiscount, priceForItem, configurationSummary } from "@/lib/pricing";
import { STATUS_LABEL } from "../../status";
import type { SubOrderStatus } from "@/lib/types";
import type { RateTier } from "@/lib/rate-tiers";
import { createManagedOrder, updateManagedOrder, type ManagedOrderLineInput } from "./actions";

export type ClientOption = { id: string; name: string; rate_tier_id: string | null };

type DraftLine = ManagedOrderLineInput & {
  id: string;
  /** Present for lines already saved on the order being edited. */
  lineId?: string;
  /** Saved RRP of an existing line, kept even if the catalogue price has since changed. */
  listPrice?: number;
  boardStatus?: string;
};

export type EditingOrder = {
  orderId: string;
  clientId: string;
  rateTierId: string | null;
  poNumber: string;
  lines: DraftLine[];
};

/** RRP of a line: the saved one for existing lines, else the current catalogue price. */
function lineRrp(catalog: CatalogProduct[], l: DraftLine) {
  return l.listPrice ?? priceForItem(catalog, l.productSlug, l.configuration) ?? 0;
}

function formatNZD(amount: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(amount);
}

export function OrderBuilder({
  clients,
  catalog,
  tiers,
  editing,
}: {
  clients: ClientOption[];
  catalog: CatalogProduct[];
  tiers: RateTier[];
  editing?: EditingOrder;
}) {
  const initialClient = editing ? clients.find((c) => c.id === editing.clientId) : clients[0];
  const [clientId, setClientId] = useState(initialClient?.id ?? "");
  const [clientQuery, setClientQuery] = useState(initialClient?.name ?? "");
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [clientHighlight, setClientHighlight] = useState(0);
  const [poNumber, setPoNumber] = useState(editing?.poNumber ?? "");
  const retail = tiers.find((t) => t.discount_percent === 0) ?? null;
  const tierFor = (clientTierId: string | null) => tiers.find((t) => t.id === clientTierId) ?? retail;
  // Starts at the client's own tier; the account manager can override it per order.
  const [tierId, setTierId] = useState(
    (editing ? tierFor(editing.rateTierId) : tierFor(clients[0]?.rate_tier_id ?? null))?.id ?? ""
  );
  const tier = tiers.find((t) => t.id === tierId) ?? null;
  const discount = tier?.discount_percent ?? 0;
  const [lines, setLines] = useState<DraftLine[]>(editing?.lines ?? []);

  const [productSlug, setProductSlug] = useState(catalog[0]?.slug ?? "");
  const product = catalog.find((p) => p.slug === productSlug) ?? catalog[0];
  const [selections, setSelections] = useState<Record<string, string | string[]>>({});
  const [quantity, setQuantity] = useState(product?.min_order_qty ?? 1);
  const [lineError, setLineError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  const missingRequired = useMemo(() => {
    if (!product) return [];
    return product.option_groups
      .filter((g) => g.required)
      .filter((g) => (g.selection === "multi" ? false : !selections[g.key]));
  }, [product, selections]);

  const total = lines.reduce((sum, l) => sum + applyTierDiscount(lineRrp(catalog, l), discount) * l.quantity, 0);

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, clientQuery]);
  const clientActiveIndex = Math.min(clientHighlight, Math.max(filteredClients.length - 1, 0));

  function selectClient(client: ClientOption) {
    setClientId(client.id);
    setTierId(tierFor(client.rate_tier_id)?.id ?? "");
    setClientQuery(client.name);
    setClientMenuOpen(false);
  }

  function handleClientInputChange(value: string) {
    setClientQuery(value);
    setClientMenuOpen(true);
    setClientHighlight(0);
    const selected = clients.find((c) => c.id === clientId);
    if (!selected || selected.name !== value) {
      setClientId("");
    }
  }

  function handleClientBlur() {
    setClientMenuOpen(false);
    const selected = clients.find((c) => c.id === clientId);
    setClientQuery(selected?.name ?? "");
  }

  function handleClientKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!clientMenuOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setClientHighlight((i) => Math.min(i + 1, filteredClients.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setClientHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const match = filteredClients[clientActiveIndex];
      if (match) selectClient(match);
    } else if (e.key === "Escape") {
      setClientMenuOpen(false);
    }
  }

  function selectProduct(slug: string) {
    setProductSlug(slug);
    setSelections({});
    const next = catalog.find((p) => p.slug === slug);
    setQuantity(next?.min_order_qty ?? 1);
    setLineError(null);
  }

  function setSingle(groupKey: string, choiceKey: string) {
    setSelections((prev) => ({ ...prev, [groupKey]: choiceKey }));
  }

  function toggleMulti(groupKey: string, choiceKey: string) {
    setSelections((prev) => {
      const current = prev[groupKey];
      const list = Array.isArray(current) ? current : [];
      const next = list.includes(choiceKey) ? list.filter((k) => k !== choiceKey) : [...list, choiceKey];
      return { ...prev, [groupKey]: next };
    });
  }

  function addLine() {
    if (!product) return;
    if (missingRequired.length > 0) {
      setLineError(`Choose an option for: ${missingRequired.map((g) => g.label).join(", ")}`);
      return;
    }
    setLineError(null);
    setLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), productSlug: product.slug, configuration: selections, quantity },
    ]);
    setSelections({});
  }

  function setLineQuantity(id: string, qty: number) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, quantity: Math.max(1, qty || 1) } : l)));
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function handleSubmit() {
    setSubmitError(null);
    setCreatedOrderId(null);
    startTransition(async () => {
      try {
        const result = editing
          ? await updateManagedOrder({
              orderId: editing.orderId,
              clientId,
              rateTierId: tierId || null,
              poNumber,
              lines: lines.map(({ lineId, productSlug, configuration, quantity }) => ({
                lineId,
                productSlug,
                configuration,
                quantity,
              })),
            })
          : await createManagedOrder({
              clientId,
              rateTierId: tierId || null,
              poNumber,
              lines: lines.map(({ productSlug, configuration, quantity }) => ({
                productSlug,
                configuration,
                quantity,
              })),
            });
        if ("error" in result) {
          setSubmitError(result.error);
          return;
        }
        setCreatedOrderId(result.orderId);
        if (!editing) {
          setLines([]);
          setPoNumber("");
        }
      } catch (err) {
        setSubmitError(`Couldn't create the order because the connection to BrandSource failed (${new Date().toLocaleString("en-NZ")}). Check your internet and try again; if it keeps happening, forward this message to Lloyd.`);
      }
    });
  }

  if (clients.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No managed clients yet —{" "}
        <Link href="/admin/clients" className="underline underline-offset-2">
          add one first
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="relative text-sm">
            <span className="mb-1 block font-medium">Client</span>
            <input
              type="text"
              role="combobox"
              aria-expanded={clientMenuOpen}
              aria-autocomplete="list"
              autoComplete="off"
              value={clientQuery}
              placeholder="Type to search, or select from the list…"
              onChange={(e) => handleClientInputChange(e.target.value)}
              onFocus={() => setClientMenuOpen(true)}
              onBlur={handleClientBlur}
              onKeyDown={handleClientKeyDown}
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
            />
            {clientMenuOpen && filteredClients.length > 0 ? (
              <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                {filteredClients.map((c, i) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectClient(c)}
                      className={`block w-full px-3 py-1.5 text-left text-sm ${
                        i === clientActiveIndex ? "bg-zinc-900 text-white" : "hover:bg-zinc-50"
                      }`}
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {clientMenuOpen && filteredClients.length === 0 ? (
              <p className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-400 shadow-lg">
                No matching clients
              </p>
            ) : null}
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Rate tier</span>
            <select
              value={tierId}
              onChange={(e) => setTierId(e.target.value)}
              disabled={tiers.length <= 1}
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
            >
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.discount_percent > 0 ? ` (${t.discount_percent}% off RRP)` : " (RRP)"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium">PO number (optional)</span>
            <input
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="Client's own PO reference"
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Add a product line</h2>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium">Product</span>
          <select
            value={productSlug}
            onChange={(e) => selectProduct(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm sm:w-80"
          >
            {catalog.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {product ? (
          <div className="mt-4 space-y-4">
            {product.option_groups.map((g) => (
              <fieldset key={g.key} className="rounded-lg border border-zinc-200 p-4">
                <legend className="px-1 text-sm font-medium">
                  {g.label}
                  {g.required ? "" : " (optional)"}
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {g.choices.map((c) => {
                    const current = selections[g.key];
                    const checked =
                      g.selection === "multi"
                        ? Array.isArray(current) && current.includes(c.key)
                        : current === c.key;
                    return (
                      <label
                        key={c.key}
                        className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${
                          checked ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"
                        }`}
                      >
                        <input
                          type={g.selection === "multi" ? "checkbox" : "radio"}
                          name={g.key}
                          checked={checked}
                          onChange={() =>
                            g.selection === "multi" ? toggleMulti(g.key, c.key) : setSingle(g.key, c.key)
                          }
                          className="sr-only"
                        />
                        {c.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            <div className="flex items-center gap-3">
              <label htmlFor="qty" className="text-sm font-medium">
                Quantity
              </label>
              <input
                id="qty"
                type="number"
                min={product.min_order_qty}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(product.min_order_qty, Number(e.target.value) || product.min_order_qty))}
                className="w-24 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
              />
              {product.min_order_qty > 1 ? (
                <span className="text-xs text-zinc-500">MOQ {product.min_order_qty}</span>
              ) : null}
            </div>

            {lineError ? <p className="text-sm text-red-600">{lineError}</p> : null}

            <button
              type="button"
              onClick={addLine}
              className="rounded-full border border-zinc-900 px-4 py-1.5 text-sm font-medium hover:bg-zinc-900 hover:text-white"
            >
              Add item to order
            </button>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Order lines</h2>
        {lines.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No lines added yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {lines.map((l) => {
              const product = catalog.find((p) => p.slug === l.productSlug);
              const rrp = lineRrp(catalog, l);
              const price = applyTierDiscount(rrp, discount);
              return (
                <li
                  key={l.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {product?.name ?? l.productSlug} × {l.quantity}
                    </p>
                    {l.lineId && l.boardStatus && l.boardStatus !== "new_order" ? (
                      <p className="text-xs text-amber-700">
                        On the board: {STATUS_LABEL[l.boardStatus as SubOrderStatus] ?? l.boardStatus}. Can&apos;t be removed until moved back to New order.
                      </p>
                    ) : null}
                    <p className="text-xs text-zinc-500">{configurationSummary(catalog, l.productSlug, l.configuration)}</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {formatNZD(price * l.quantity)}
                      {discount > 0 ? ` · ${formatNZD(price)} each, RRP ${formatNZD(rrp)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {l.lineId ? (
                      <input
                        type="number"
                        min={1}
                        value={l.quantity}
                        onChange={(e) => setLineQuantity(l.id, Number(e.target.value))}
                        aria-label="Quantity"
                        className="w-20 rounded-lg border border-zinc-300 px-2 py-1 text-xs"
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeLine(l.id)}
                      disabled={!!l.lineId && !!l.boardStatus && l.boardStatus !== "new_order"}
                      className="text-xs text-zinc-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-zinc-400"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
          <span className="text-sm text-zinc-500">Total</span>
          <span className="text-sm font-semibold">{formatNZD(total)}</span>
        </div>

        {submitError ? <p className="mt-3 text-sm text-red-600">{submitError}</p> : null}
        {createdOrderId ? (
          <p className="mt-3 text-sm text-emerald-600">
            {editing ? "Changes saved" : "Order created"} —{" "}
            <Link href="/admin" className="underline underline-offset-2">
              view it on the team dashboard
            </Link>
            .
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || lines.length === 0 || !clientId}
          className="mt-4 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? (editing ? "Saving…" : "Creating…") : editing ? "Save changes" : "Create order"}
        </button>
      </div>
    </div>
  );
}
