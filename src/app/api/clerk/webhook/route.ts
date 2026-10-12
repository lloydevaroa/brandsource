import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { getResend } from "@/lib/resend";

export const runtime = "nodejs";

// Sign-ups from these domains trigger an alert email (comma-separated env
// override: SIGNUP_ALERT_DOMAINS).
const TEAM_DOMAINS = (process.env.SIGNUP_ALERT_DOMAINS ?? "brandspanking.co.nz")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

type ClerkUserCreated = {
  type: string;
  data: {
    first_name: string | null;
    last_name: string | null;
    primary_email_address_id: string | null;
    email_addresses: { id: string; email_address: string }[];
  };
};

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const payload = await req.text();

  let event: ClerkUserCreated;
  try {
    event = new Webhook(secret).verify(payload, {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    }) as unknown as ClerkUserCreated;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "user.created") {
    return NextResponse.json({ received: true });
  }

  const { data } = event;
  const email =
    data.email_addresses.find((e) => e.id === data.primary_email_address_id)?.email_address ??
    data.email_addresses[0]?.email_address;
  const domain = email?.split("@")[1]?.toLowerCase();
  if (!email || !domain || !TEAM_DOMAINS.includes(domain)) {
    return NextResponse.json({ received: true });
  }

  const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || "(no name given)";
  try {
    await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "BRANDSource <onboarding@resend.dev>",
      to: process.env.SIGNUP_ALERT_EMAIL ?? "lloyd@reallygood.marketing",
      subject: "BRANDspanking sign up",
      text: `${name} (${email}) just created a BRANDSource account.`,
    });
  } catch (err) {
    // Returning 200 anyway: a failed alert shouldn't make Clerk retry and
    // re-deliver the sign-up event.
    console.error("Sign-up alert email failed:", err);
  }

  return NextResponse.json({ received: true });
}
