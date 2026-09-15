import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/postscript", // .ai / .eps
  "application/illustrator",
  "application/octet-stream", // browsers often can't classify .ai files
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "svg", "pdf", "ai", "eps"]);

function safeSegment(input: string, fallback: string) {
  const cleaned = input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return cleaned || fallback;
}

function safeFilename(input: string) {
  const base = input.split(/[/\\]/).pop() ?? "artwork";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return cleaned || "artwork";
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
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 25MB limit" }, { status: 413 });
  }

  const filename = safeFilename(file.name || "artwork");
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const typeOk = ALLOWED_TYPES.has(file.type) || ALLOWED_EXTENSIONS.has(extension);
  if (!typeOk) {
    return NextResponse.json(
      { error: "Unsupported file type. Use JPG, PNG, WEBP, SVG, PDF, AI or EPS." },
      { status: 415 }
    );
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
