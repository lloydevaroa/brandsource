import { NextResponse, type NextRequest } from "next/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { completeConnection } from "@/lib/xero";

/** Xero redirects the staff member's browser back here after they approve access. */
export async function GET(req: NextRequest) {
  const back = (query: string) => {
    const res = NextResponse.redirect(new URL(`/admin/xero?${query}`, req.url));
    res.cookies.delete({ name: "xero_oauth_state", path: "/api/xero" });
    return res;
  };

  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return back(`error=${encodeURIComponent(params.get("error")!)}`);

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || state !== req.cookies.get("xero_oauth_state")?.value) {
    return back("error=state_mismatch");
  }

  try {
    await completeConnection(code, req.nextUrl.origin, profile.id);
    return back("connected=1");
  } catch (err) {
    console.error("[xero] connect failed", err);
    return back("error=connect_failed");
  }
}
