import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { buildAuthorizeUrl, isXeroConfigured } from "@/lib/xero";

/** Staff-only: starts the Xero OAuth flow for BrandSource's Xero organisation. */
export async function GET(req: NextRequest) {
  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }
  if (!isXeroConfigured()) {
    return NextResponse.redirect(new URL("/admin/xero?error=not_configured", req.url));
  }

  const state = randomUUID();
  const res = NextResponse.redirect(buildAuthorizeUrl(req.nextUrl.origin, state));
  res.cookies.set("xero_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/xero",
    maxAge: 600,
  });
  return res;
}
