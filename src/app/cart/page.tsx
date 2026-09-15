"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { catalog } from "@/data/catalog";
import { useCart, type CartItem } from "@/lib/cart";

function configurationSummary(item: CartItem) {
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

function CartLine({ item }: { item: CartItem }) {
  const { removeItem, updateQuantity, addArtwork, removeArtwork } = useCart();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const summary = configurationSummary(item);

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

export default function CartPage() {
  const { items } = useCart();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/#products" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Trade Show products
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Your quote request</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Flat pricing · Price TBD until PO quotes land. Upload artwork below — we&apos;ll proof
          each item before production.
        </p>

        {items.length === 0 ? (
          <p className="mt-10 text-zinc-600">
            Nothing here yet.{" "}
            <Link href="/#products" className="underline underline-offset-2">
              Browse Trade Show products
            </Link>
            .
          </p>
        ) : (
          <>
            <ul className="mt-8 space-y-4">
              {items.map((item) => (
                <CartLine key={item.id} item={item} />
              ))}
            </ul>

            <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5">
              <button
                type="button"
                className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white opacity-60"
                disabled
              >
                Submit quote request (coming soon)
              </button>
              <p className="mt-2 text-sm text-zinc-500">
                Checkout lands in the next build slice — Stripe payment and sub-order creation.
                Your items and uploaded artwork stay saved in this browser until then.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
