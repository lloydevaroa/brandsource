"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { addHeroSlide, createHeroUpload } from "./actions";

const MAX_BYTES = 10 * 1024 * 1024;

export function HeroUploader({ pageKey }: { pageKey: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      for (const file of files) {
        if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
        if (file.size > MAX_BYTES) throw new Error(`${file.name} is over 10MB. Please shrink it first.`);
        const { path, token } = await createHeroUpload(pageKey, file.name);
        const { error: upErr } = await supabase.storage
          .from("hero-images")
          .uploadToSignedUrl(path, token, file, { contentType: file.type });
        if (upErr) throw new Error(upErr.message);
        await addHeroSlide(pageKey, path);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={busy}
        onChange={onChange}
        className="block text-sm file:mr-4 file:rounded-full file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800"
      />
      <p className="mt-2 text-xs text-zinc-500">
        {busy ? "Uploading…" : "JPG, PNG or WEBP, up to 10MB each. Wide images (about 2400 × 1000) work best."}
      </p>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
