"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadProgress } from "@/components/UploadProgress";
import { uploadWithProgress } from "@/lib/upload-with-progress";

export type UploadedFile = { id: string; name: string };

/** Upload and remove artwork for one ordered item. Refreshes the page data after each change. */
export function ArtworkUploader({
  orderId,
  lineId,
  files,
  templateUrl,
}: {
  orderId: string;
  lineId: string;
  files: UploadedFile[];
  templateUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ name: string; percent: number; position?: string } | null>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const [i, file] of picked.entries()) {
        const position = picked.length > 1 ? `${i + 1} of ${picked.length}` : undefined;
        setProgress({ name: file.name, percent: 0, position });
        const form = new FormData();
        form.append("file", file);
        form.append("lineId", lineId);
        const res = await uploadWithProgress(`/api/orders/${orderId}/artwork`, form, (percent) =>
          setProgress({ name: file.name, percent, position })
        );
        if (!res.ok) {
          const reason =
            res.status === 413
              ? "That file is too large to upload here."
              : typeof res.data.error === "string"
                ? res.data.error
                : "Upload failed.";
          setError(`${file.name}: ${reason}`);
          break;
        }
      }
      router.refresh();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(fileId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/artwork`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Could not remove the file.");
      else router.refresh();
    } catch {
      setError("Could not remove the file. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {templateUrl ? (
          <a
            href={templateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-brand-charcoal px-4 py-2 text-sm font-bold uppercase tracking-wide text-brand-charcoal hover:bg-brand-charcoal hover:text-white"
          >
            Download design template
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded bg-brand-orange px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#e64300] disabled:opacity-60"
        >
          {busy ? (progress ? "Uploading…" : "Working…") : files.length > 0 ? "Upload another file" : "Upload artwork"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.svg,.pdf,.ai,.eps"
          onChange={upload}
          disabled={busy}
          className="hidden"
        />
      </div>
      {progress ? <UploadProgress fileName={progress.name} percent={progress.percent} position={progress.position} /> : null}
      {files.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-sm text-zinc-700">
              <span aria-hidden className="text-emerald-600">✓</span>
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => remove(f.id)}
                disabled={busy}
                className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-60"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">JPG, PNG, WebP, SVG, PDF, AI or EPS, up to 25MB each.</p>
      )}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
