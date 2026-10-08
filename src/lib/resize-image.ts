// Browser-side shrink for staff-uploaded product photos: big phone or camera files
// are scaled down and re-encoded as WebP so product pages stay fast. Small files
// and anything the browser can't decode are sent untouched.

const MAX_SIDE = 2000;
const SKIP_UNDER_BYTES = 400 * 1024;

export async function prepareImage(file: File): Promise<{ blob: Blob; filename: string; type: string }> {
  const untouched = { blob: file as Blob, filename: file.name, type: file.type };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < SKIP_UNDER_BYTES) {
      bitmap.close();
      return untouched;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.88));
    if (!blob || blob.size >= file.size) return untouched;
    return { blob, filename: file.name.replace(/\.[^.]+$/, "") + ".webp", type: "image/webp" };
  } catch {
    return untouched;
  }
}
