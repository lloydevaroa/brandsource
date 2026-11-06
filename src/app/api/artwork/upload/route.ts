import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { safeArtworkFilename, validateArtworkFile } from "@/lib/artwork";

export const runtime = "nodejs";

function safeSegment(input: string, fallback: string) {
  const cleaned = input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return cleaned || fallback;
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  const cartItemIdRaw = form.get("cartItemId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (typeof cartItemIdRaw !== "string" || !cartItemIdRaw) {
    return NextResponse.json({ error: "Missing cartItemId" }, { status: 400 });
  }

  const filename = safeArtworkFilename(file.name || "artwork");
  const invalid = validateArtworkFile(file, filename);
  if (invalid) {
    return NextResponse.json({ error: invalid.error }, { status: invalid.status });
  }

  const cartItemId = safeSegment(cartItemIdRaw, "unknown");
  const storagePath = `staged/${cartItemId}/${Date.now()}-${filename}`;

  let supabase;
  try {
    supabase = createServiceSupabase();
  } catch {
    return NextResponse.json(
      { error: "Artwork storage is not configured on this deployment yet." },
      { status: 503 }
    );
  }

  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage.from("artwork").upload(storagePath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ path: storagePath, filename });
}
