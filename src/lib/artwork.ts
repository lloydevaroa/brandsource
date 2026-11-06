/** Shared rules for artwork uploads, used by the cart upload and the order-page upload. */

export const ARTWORK_MAX_BYTES = 25 * 1024 * 1024;

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

export function safeArtworkFilename(input: string) {
  const base = input.split(/[/\\]/).pop() ?? "artwork";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return cleaned || "artwork";
}

/** Returns an error message and HTTP status, or null when the file is acceptable. */
export function validateArtworkFile(file: File, filename: string): { error: string; status: number } | null {
  if (file.size === 0) return { error: "File is empty", status: 400 };
  if (file.size > ARTWORK_MAX_BYTES) return { error: "File exceeds 25MB limit", status: 413 };
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_TYPES.has(file.type) && !ALLOWED_EXTENSIONS.has(extension)) {
    return { error: "Unsupported file type. Use JPG, PNG, WEBP, SVG, PDF, AI or EPS.", status: 415 };
  }
  return null;
}

/** "1730000000000-logo.pdf" in storage becomes "logo.pdf" on screen. */
export function artworkDisplayName(storagePath: string) {
  const base = storagePath.split("/").pop() ?? storagePath;
  return base.replace(/^\d+-/, "");
}
