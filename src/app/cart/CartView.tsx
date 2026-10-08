"use client";

import Link from "next/link";
import { Suspense, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { SiteHeader } from "@/components/SiteHeader";
import type { CatalogProduct } from "@/lib/catalog";
import { useCart, type CartItem } from "@/lib/cart";
import { applyTierDiscount } from "@/lib/pricing";
import { createManagedOrder } from "@/app/admin/orders/new/actions";

export type CartTier = { name: string; discountPercent: number } | null;
export type StaffOrdering = {
  tiers: { id: string; name: string; discountPercent: number }[];
  clients: { id: string; name: string; tierId: string }[];
};

function unitPrice(catalog: CatalogProduct[], item: CartItem, discountPercent = 0) {
  const product = catalog.find((p) => p.slug === item.productSlug);
  if (!product) return null;
  const base = product.unit_price ?? null;
  if (base === null) return null;
  const delta = product.option_groups.reduce((sum, g) => {
    const selected = item.configuration[g.key];
    if (!selected) return sum;
    const keys = Array.isArray(selected) ? selected : [selected];
    return (
      sum +
      keys.reduce((s, k) => s + (g.choices.find((c) => c.key === k)?.price_delta ?? 0), 0)
    );
  }, 0);
  const rrp = base + delta;
  return discountPercent > 0 ? applyTierDiscount(rrp, discountPercent) : rrp;
}

function formatNZD(amount: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(amount);
}

function configurationSummary(catalog: CatalogProduct[], item: CartItem) {
  const product = catalog.find((p) => p.slug === item.productSlug);
  if (!product) return [] as { label: string; value: string }[];
  return product.option_groups.flatMap((g) => {
    const selected = item.configuration[g.key];
    if (!selected || (Array.isArray(selected) && selected.length === 0)) return [];
    const keys = Array.isArray(selected) ? selected : [selected];
    const labels = keys
      .map((k) => g.choices.find((c) => c.key === k)?.label)
      .filter(Boolean)
      .join(", ");
    return labels ? [{ label: g.label, value: labels }] : [];
  });
}

function CartLine({ item, catalog, tier }: { item: CartItem; catalog: CatalogProduct[]; tier: CartTier }) {
  const { removeItem, updateQuantity, addArtwork, removeArtwork } = useCart();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const summary = configurationSummary(catalog, item);
  const price = unitPrice(catalog, item, tier?.discountPercent);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("cartItemId", item.id);
      const res = await fetch("/api/artwork/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed");
        return;
      }
      addArtwork(item.id, { path: data.path, filename: data.filename });
    } catch {
      setUploadError("Upload failed — check your connection and try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/products/${item.productSlug}`} className="font-medium hover:underline">
            {item.productName}
          </Link>
          {summary.length > 0 ? (
            <p className="mt-1 text-sm text-zinc-500">
              {summary.map((s) => `${s.label}: ${s.value}`).join(" · ")}
            </p>
          ) : null}
          {price !== null ? (
            <p className="mt-1 text-sm font-medium text-zinc-700">
              {formatNZD(price)} each · {formatNZD(price * item.quantity)} total
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => removeItem(item.id)}
          className="text-sm text-zinc-400 hover:text-red-600"
        >
          Remove
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label htmlFor={`qty-${item.id}`} className="text-sm font-medium">
          Quantity
        </label>
        <input
          id={`qty-${item.id}`}
          type="number"
          min={1}
          value={item.quantity}
          onChange={(e) => updateQuantity(item.id, Number(e.target.value) || 1)}
          className="w-24 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium">Artwork</p>
        {item.artwork.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {item.artwork.map((a) => (
              <li key={a.path} className="flex items-center gap-2 text-sm text-zinc-600">
                <span>{a.filename}</span>
                <button
                  type="button"
                  onClick={() => removeArtwork(item.id, a.path)}
                  className="text-xs text-zinc-400 hover:text-red-600"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.svg,.pdf,.ai,.eps"
            onChange={handleFileChange}
            disabled={uploading}
            className="text-sm"
          />
          {uploading ? <span className="ml-2 text-sm text-zinc-500">Uploading…</span> : null}
        </div>
        {uploadError ? <p className="mt-1 text-sm text-red-600">{uploadError}</p> : null}
      </div>
    </li>
  );
}

/**
 * Staff only: raise the cart as a PO order for a managed client instead of paying by card.
 * The order uses the client's default tier; change it afterwards with Edit order on the dashboard.
 */
function StaffPoOrder({
  clients,
  tiers,
  onTierChange,
  onCreated,
}: {
  clients: StaffOrdering["clients"];
  tiers: StaffOrdering["tiers"];
  onTierChange: (tier: CartTier) => void;
  onCreated: (clientName: string) => void;
}) {
  const { items, clear } = useCart();
  const [clientId, setClientId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [tierId, setTierId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientQuery, setClientQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const sortedClients = useMemo(() => [...clients].sort((x, y) => x.name.localeCompare(y.name)), [clients]);
  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    return q ? sortedClients.filter((c) => c.name.toLowerCase().includes(q)) : sortedClients;
  }, [sortedClients, clientQuery]);
  const activeIndex = Math.min(highlight, Math.max(filteredClients.length - 1, 0));
  const chosen = clients.find((c) => c.id === clientId);

  // The chosen tier also drives the prices shown in the cart above.
  function applyTier(id: string) {
    setTierId(id);
    const t = tiers.find((x) => x.id === id);
    onTierChange(t && t.discountPercent > 0 ? { name: t.name, discountPercent: t.discountPercent } : null);
  }
  function chooseClient(c: StaffOrdering["clients"][number]) {
    setClientId(c.id);
    setClientQuery(c.name);
    setMenuOpen(false);
    applyTier(c.tierId);
  }
  function onClientInput(value: string) {
    setClientQuery(value);
    setMenuOpen(true);
    setHighlight(0);
    if (chosen && chosen.name !== value) {
      setClientId("");
      applyTier("");
    }
  }
  function onClientBlur() {
    setMenuOpen(false);
    setClientQuery(chosen?.name ?? "");
  }
  function onClientKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!menuOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, filteredClients.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const match = filteredClients[activeIndex];
      if (match) chooseClient(match);
    } else if (e.key === "Escape") {
      setMenuOpen(false);
    }
  }

  async function submit() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createManagedOrder({
        clientId: chosen.id,
        rateTierId: tierId || null,
        poNumber,
        lines: items.map((i) => ({
          productSlug: i.productSlug,
          configuration: i.configuration,
          quantity: i.quantity,
          artwork: i.artwork,
        })),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      clear();
      onTierChange(null);
      onCreated(chosen.name);
    } catch {
      setError("Couldn't create the order because the connection to BrandSource failed. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="text-sm font-semibold text-amber-900">Staff: create a PO order for a client</h2>
      <p className="mt-1 text-xs text-amber-800">
        The tier starts at the client&apos;s saved tier (Retail if none). Change it here to price this order, and the prices above update. It can also be changed later with Edit order on the dashboard.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="relative text-sm">
          <span className="mb-1 block font-medium">Client</span>
          <input
            type="text"
            role="combobox"
            aria-expanded={menuOpen}
            aria-autocomplete="list"
            autoComplete="off"
            value={clientQuery}
            placeholder="Type to search, or select from the list…"
            onChange={(e) => onClientInput(e.target.value)}
            onFocus={() => setMenuOpen(true)}
            onBlur={onClientBlur}
            onKeyDown={onClientKeyDown}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          />
          {menuOpen && filteredClients.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
              {filteredClients.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => chooseClient(c)}
                    className={`block w-full px-3 py-1.5 text-left text-sm ${
                      i === activeIndex ? "bg-zinc-900 text-white" : "hover:bg-zinc-50"
                    }`}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {menuOpen && filteredClients.length === 0 ? (
            <p className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-400 shadow-lg">
              No matching clients
            </p>
          ) : null}
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Rate tier</span>
          <select
            value={tierId}
            onChange={(e) => applyTier(e.target.value)}
            disabled={!chosen}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm disabled:opacity-60"
          >
            {!chosen ? <option value="">Choose a client first</option> : null}
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.discountPercent > 0 ? ` (${t.discountPercent}% off RRP)` : " (RRP)"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">PO number (optional)</span>
          <input
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          />
        </label>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={submit}
        disabled={busy || !chosen}
        className="mt-4 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {busy ? "Creating…" : "Create PO order"}
      </button>
    </div>
  );
}

export function CartView({ catalog, tier, staff }: { catalog: CatalogProduct[]; tier: CartTier; staff: StaffOrdering | null }) {
  return (
    <Suspense fallback={null}>
      <CartPageInner catalog={catalog} tier={tier} staff={staff} />
    </Suspense>
  );
}

function CartPageInner({ catalog, tier, staff }: { catalog: CatalogProduct[]; tier: CartTier; staff: StaffOrdering | null }) {
  const { items, clear } = useCart();
  const searchParams = useSearchParams();
  const canceled = searchParams.get("canceled");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdFor, setCreatedFor] = useState<string | null>(null);
  // Tier chosen by staff for the PO order in progress; a customer's own tier takes no part here.
  const [staffTier, setStaffTier] = useState<CartTier>(null);
  const activeTier = tier ?? staffTier;

  const subtotal = items.reduce((sum, item) => {
    const price = unitPrice(catalog, item, activeTier?.discountPercent);
    return price === null ? sum : sum + price * item.quantity;
  }, 0);
  const hasUnpriced = items.some((item) => unitPrice(catalog, item, activeTier?.discountPercent) === null);

  async function handleCheckout() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productSlug: i.productSlug,
            configuration: i.configuration,
            quantity: i.quantity,
            artwork: i.artwork,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Could not start checkout.");
        return;
      }
      clear();
      window.location.href = data.url;
    } catch {
      setSubmitError("Could not start checkout — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-brand-charcoal">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-6 [&>*]:max-w-3xl py-10">
        <Link href="/category/trade-show-and-events" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Trade Show products
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Your cart</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {activeTier ? `${activeTier.name} rate applied (${activeTier.discountPercent}% off RRP). ` : "Flat pricing. "}Upload artwork below — we&apos;ll proof each item before production.
        </p>
        {createdFor ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            PO order created for {createdFor}.{" "}
            <Link href="/admin" className="font-medium underline underline-offset-2">
              View it on the team dashboard
            </Link>
            , where Edit order lets you change the rate tier.
          </div>
        ) : null}
        {canceled ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Checkout was canceled. Your cart is still here whenever you&apos;re ready.
          </div>
        ) : null}

        {items.length === 0 ? (
          <p className="mt-10 text-zinc-600">
            Nothing here yet.{" "}
            <Link href="/category/trade-show-and-events" className="underline underline-offset-2">
              Browse Trade Show products
            </Link>
            .
          </p>
        ) : (
          <>
            <ul className="mt-8 space-y-4">
              {items.map((item) => (
                <CartLine key={item.id} item={item} catalog={catalog} tier={activeTier} />
              ))}
            </ul>

            {staff ? <StaffPoOrder clients={staff.clients} tiers={staff.tiers} onTierChange={setStaffTier} onCreated={setCreatedFor} /> : null}

            <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="text-zinc-500">Subtotal</span>
                <span className="font-semibold">{formatNZD(subtotal)}</span>
              </div>
              <SignedIn>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={submitting || hasUnpriced || !!staffTier}
                  className="px-5 py-2.5 text-sm rounded bg-brand-orange text-white font-bold uppercase tracking-wide hover:bg-[#e64300] disabled:opacity-60"
                >
                  {submitting ? "Redirecting to payment…" : "Proceed to payment"}
                </button>
                <p className="mt-2 text-sm text-zinc-500">
                  You&apos;ll pay securely via Stripe, then we&apos;ll proof your artwork before
                  anything goes to production.
                </p>
                {staffTier ? (
                  <p className="mt-2 text-sm text-amber-700">
                    Card payment is off while a client rate tier is applied above. Use Create PO order, or set the tier back to Retail.
                  </p>
                ) : null}
                {submitError ? <p className="mt-2 text-sm text-red-600">{submitError}</p> : null}
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="px-5 py-2.5 text-sm rounded bg-brand-orange text-white font-bold uppercase tracking-wide hover:bg-[#e64300]"
                  >
                    Sign in to check out
                  </button>
                </SignInButton>
                <p className="mt-2 text-sm text-zinc-500">
                  Sign in so we can track your order and payment.
                </p>
              </SignedOut>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
