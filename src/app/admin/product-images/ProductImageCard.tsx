"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { addProductImage, createProductImageUpload, moveProductImage, removeProductImage } from "./actions";

const MAX_BYTES = 10 * 1024 * 1024;

type Product = { slug: string; name: string; supplier: string; images: string[] };

export function ProductImageCard({ product }: { product: Product }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const busy = uploading || pending;

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      for (const file of files) {
        if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
        if (file.size > MAX_BYTES) throw new Error(`${file.name} is over 10MB. Please shrink it first.`);
        const { path, token } = await createProductImageUpload(product.slug, file.name);
        const { error: upErr } = await supabase.storage
          .from("product-images")
          .uploadToSignedUrl(path, token, file, { contentType: file.type });
        if (upErr) throw new Error(upErr.message);
        await addProductImage(product.slug, path);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  function run(fn: () => Promise<void>) {
    setError(null);
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const btn =
    "rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-700 hover:border-zinc-500 disabled:opacity-40";

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">{product.name}</h2>
        <span className="text-xs text-zinc-500">{product.supplier}</span>
      </div>

      {product.images.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No images yet.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {product.images.map((src, i) => (
            <li key={src} className="space-y-1.5">
              <div className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-white">
                <Image src={src} alt="" fill className="object-contain" sizes="160px" />
                {i === 0 ? (
                  <span className="absolute left-1 top-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-white">
                    Main
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1">
                <button type="button" className={btn} disabled={busy || i === 0}
                  onClick={() => run(() => moveProductImage(product.slug, src, "up"))}>
                  ←
                </button>
                <button type="button" className={btn} disabled={busy || i === product.images.length - 1}
                  onClick={() => run(() => moveProductImage(product.slug, src, "down"))}>
                  →
                </button>
                <button type="button" className={`${btn} text-red-600`} disabled={busy}
                  onClick={() => {
                    if (confirm("Remove this image?")) run(() => removeProductImage(product.slug, src));
                  }}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy}
          onChange={onChange}
          className="block text-sm file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:transition hover:file:bg-zinc-600 active:file:scale-95 disabled:opacity-60"
        />
        <p className="mt-2 text-xs text-zinc-500">
          {uploading ? "Uploading…" : "JPG, PNG or WEBP, up to 10MB each. Square images on a white background work best."}
        </p>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>
    </li>
  );
}
