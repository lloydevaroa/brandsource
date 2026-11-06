import { NextResponse } from "next/server";
import { getRateTiers } from "@/lib/rate-tiers";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { createServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Managed clients (with their default rate tier) for the staff "create a PO order" panel on the cart.
 * Loaded by the panel itself, so the cart page no longer carries the whole client list for staff.
 * Staff only.
 */
export async function GET() {
  try {
    const profile = await syncCurrentProfile();
    if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
      return NextResponse.json({ error: "Staff only." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    const supabase = createServiceSupabase();
    const [tiers, withTier] = await Promise.all([
      getRateTiers(),
      supabase.from("clients").select("id, name, rate_tier_id").eq("client_type", "managed").order("name", { ascending: true }),
    ]);
    // supabase/rate-tiers.sql not run yet: list clients without tiers.
    const rows = withTier.error
      ? ((await supabase.from("clients").select("id, name").eq("client_type", "managed").order("name", { ascending: true })).data ?? []).map((c) => ({ ...c, rate_tier_id: null }))
      : withTier.data ?? [];
    const retail = tiers.find((t) => t.discount_percent === 0);
    return NextResponse.json(
      // A client with no tier of their own is Retail.
      rows.map((c) => ({ id: c.id, name: c.name, tierId: c.rate_tier_id ?? retail?.id ?? "" })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load clients." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
