import { NextResponse } from "next/server";
import { getCatalogForSlugs } from "@/lib/catalog";

export const runtime = "nodejs";

const MAX_SLUGS = 60;

/**
 * Catalogue entries for just the products in the cart (?slugs=a,b,c). The cart page used to ship
 * the whole catalogue to every visitor (about 7 MB); now it asks for the one or two it needs.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("slugs") ?? "";
  const slugs = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_SLUGS);
  if (slugs.length === 0) return NextResponse.json([]);
  try {
    const products = await getCatalogForSlugs(slugs);
    return NextResponse.json(products, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load products." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
