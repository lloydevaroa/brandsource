"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { prepareImage } from "@/lib/resize-image";
import { addProductImage, createProductImageUpload } from "./actions";

type Product = { slug: string; name: string };
type Item = { id: number; file: File; preview: string; order: number; slug: string | null; typed: string };

const MAX_BYTES = 10 * 1024 * 1024;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** "Hanging Banner - 2.jpg" -> { key: "hanging banner", order: 2 } */
function parseName(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "");
  const m = base.match(/^(.*?)[\s_-]*\(?(\d{1,2})\)?$/);
  const stem = m && m[1].trim() ? m[1] : base;
  return { key: norm(stem), order: m && m[1].trim() ? Number(m[2]) : 0, whole: norm(base) };
}

export function BulkUploader({ products }: { products: Product[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [drag, setDrag] = useState(false);

  const byName = useMemo(() => new Map(products.map((p) => [norm(p.name), p])), [products]);

  function addFiles(list: FileList | File[]) {
    setMessage(null);
    const next: Item[] = [];
    let skipped = 0;
    for (const file of Array.from(list)) {
      if (!file.type.startsWith("image/") || file.size > MAX_BYTES) {
        skipped++;
        continue;
      }
      const { key, order, whole } = parseName(file.name);
      const match = byName.get(whole) ?? byName.get(key) ?? null;
      next.push({
        id: Date.now() + Math.random(),
        file,
        preview: URL.createObjectURL(file),
        order,
        slug: match?.slug ?? null,
        typed: match?.name ?? "",
      });
    }
    if (skipped) setMessage({ kind: "error", text: `${skipped} file(s) skipped: not an image, or over 10MB.` });
    setItems((cur) => [...cur, ...next]);
  }

  function setTyped(id: number, text: string) {
    const match = products.find((p) => p.name === text) ?? null;
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, typed: text, slug: match?.slug ?? null } : i)));
  }

  const ready = items.filter((i) => i.slug);
  const unmatched = items.length - ready.length;

  async function upload() {
    setBusy(true);
    setMessage(null);
    setProgress(0);
    // Within a product, upload in numbered order so "-1" ends up as the main image.
    const queue = [...ready].sort((a, b) => a.order - b.order || a.file.name.localeCompare(b.file.name));
    const done = new Set<number>();
    try {
      const supabase = createBrowserSupabase();
      for (const item of queue) {
        const prepared = await prepareImage(item.file);
        const { path, token } = await createProductImageUpload(item.slug!, prepared.filename);
        const { error } = await supabase.storage
          .from("product-images")
          .uploadToSignedUrl(path, token, prepared.blob, { contentType: prepared.type });
        if (error) throw new Error(`${item.file.name}: ${error.message}`);
        await addProductImage(item.slug!, path);
        done.add(item.id);
        setProgress(done.size);
      }
      setMessage({ kind: "ok", text: `Uploaded ${done.size} image(s).` });
    } catch (err) {
      setMessage({
        kind: "error",
        text: `${err instanceof Error ? err.message : "Upload failed."} ${done.size} uploaded before it stopped; those are saved.`,
      });
    } finally {
      setItems((cur) => cur.filter((i) => !done.has(i.id)));
      setBusy(false);
      if (input.current) input.current.value = "";
      router.refresh();
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="font-medium">Bulk upload</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Drop in a batch. Files are matched to products by name: <code>Hanging Banner.jpg</code>, or{" "}
        <code>Hanging Banner - 1.jpg</code>, <code>- 2.jpg</code> for several (1 becomes the main image). Anything
        that doesn&apos;t match, pick the product from the list.
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        className={`mt-4 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm ${
          drag ? "border-zinc-900 bg-zinc-50" : "border-zinc-300"
        }`}
      >
        <p className="text-zinc-600">Drag images here, or</p>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy}
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          className="mt-2 text-sm file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-600"
        />
      </div>

      {items.length > 0 ? (
        <>
          <datalist id="bulk-products">
            {products.map((p) => <option key={p.slug} value={p.name} />)}
          </datalist>
          <ul className="mt-4 divide-y divide-zinc-100">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.preview} alt="" className="h-12 w-12 rounded border border-zinc-200 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{i.file.name}</p>
                  <input
                    list="bulk-products"
                    value={i.typed}
                    disabled={busy}
                    onChange={(e) => setTyped(i.id, e.target.value)}
                    placeholder="Type in the product you would like to provide an image"
                    className={`mt-1 w-full rounded border px-2 py-1 text-sm ${
                      i.slug ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"
                    }`}
                  />
                  {i.slug ? null : (
                    <p className="mt-0.5 text-xs text-amber-700">
                      {i.typed ? "Not a product name yet, pick one from the list." : "No match found."}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setItems((cur) => cur.filter((x) => x.id !== i.id))}
                  className="text-xs text-zinc-500 hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy || ready.length === 0}
              onClick={upload}
              className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-600 disabled:opacity-50"
            >
              {busy ? `Uploading ${progress} of ${ready.length}…` : `Upload ${ready.length} image(s)`}
            </button>
            {unmatched > 0 ? (
              <span className="text-sm text-amber-700">{unmatched} not matched yet and will be left out.</span>
            ) : null}
          </div>
        </>
      ) : null}
      {message ? (
        <p className={`mt-3 text-sm ${message.kind === "ok" ? "text-green-700" : "text-red-600"}`}>{message.text}</p>
      ) : null}
    </section>
  );
}
