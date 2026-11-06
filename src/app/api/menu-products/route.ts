import { NextResponse } from "next/server";
import { getMenuIndex } from "@/lib/categories";

export const runtime = "nodejs";

/**
 * Every menu product, loaded by the browser after the page is up (search, dropdowns, A to Z).
 * Kept out of the page itself because it added hundreds of KB to every page. Shared by all
 * visitors through the CDN for an hour.
 */
export async function GET() {
  const index = await getMenuIndex();
  // An empty index means the read failed: don't let the CDN hold on to that.
  const cacheControl =
    index.categories.length > 0
      ? "public, s-maxage=3600, stale-while-revalidate=86400"
      : "no-store";
  return NextResponse.json(index, { headers: { "Cache-Control": cacheControl } });
}
