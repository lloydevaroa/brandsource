import { NextResponse } from "next/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { buildReport, isReportKey } from "@/lib/reports";

export const runtime = "nodejs";

/** Admin CSV reporting: /admin/orders/export?report=transactions|customer|item|price */
export async function GET(req: Request) {
  const profile = await syncCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (profile.role !== "admin" && profile.role !== "manager") {
    return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  }

  const report = new URL(req.url).searchParams.get("report");
  if (!isReportKey(report)) {
    return NextResponse.json({ error: "Unknown report" }, { status: 400 });
  }

  const csv = await buildReport(report);
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="brandsource-${report}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
