import { createServiceSupabase } from "./supabase/server";

/**
 * Xero push (build-brief.md item 5). Plain fetch against Xero's OAuth2 and
 * Accounting API rather than the xero-node SDK: we only need a handful of
 * calls (connect, refresh, find/create contact, create invoice).
 *
 * Scopes are Xero's granular ones — apps created after 2 March 2026 can't be
 * granted the old broad `accounting.transactions` scope.
 */

const AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const TOKEN_URL = "https://identity.xero.com/connect/token";
const CONNECTIONS_URL = "https://api.xero.com/connections";
const API_BASE = "https://api.xero.com/api.xro/2.0";

export const XERO_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.invoices",
  "accounting.contacts",
].join(" ");

function credentials() {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing XERO_CLIENT_ID / XERO_CLIENT_SECRET");
  return { clientId, clientSecret };
}

export function isXeroConfigured() {
  return Boolean(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);
}

export function xeroRedirectUri(origin: string) {
  return `${origin}/api/xero/callback`;
}

export function buildAuthorizeUrl(origin: string, state: string) {
  const { clientId } = credentials();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: xeroRedirectUri(origin),
    scope: XERO_SCOPES,
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = credentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Xero token request failed (${res.status}): ${await res.text()}`);
  return res.json();
}

function expiresAt(expiresIn: number) {
  // Refresh a minute early so a token never expires mid-request.
  return new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();
}

/** Exchanges the OAuth code and stores the connection (one Xero organisation). */
export async function completeConnection(code: string, origin: string, connectedById: string) {
  const tokens = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: xeroRedirectUri(origin),
  });

  const res = await fetch(CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Could not read Xero connections (${res.status})`);
  const connections = (await res.json()) as { tenantId: string; tenantName: string; tenantType: string }[];
  const org = connections.find((c) => c.tenantType === "ORGANISATION");
  if (!org) throw new Error("No Xero organisation was authorised.");

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("xero_connection").upsert({
    id: 1,
    tenant_id: org.tenantId,
    tenant_name: org.tenantName,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt(tokens.expires_in),
    connected_by_id: connectedById,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return org.tenantName;
}

export async function getXeroConnection() {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("xero_connection")
    .select("tenant_id, tenant_name, access_token, refresh_token, expires_at, updated_at")
    .eq("id", 1)
    .maybeSingle();
  return data;
}

export async function disconnectXero() {
  const supabase = createServiceSupabase();
  const { error } = await supabase.from("xero_connection").delete().eq("id", 1);
  if (error) throw new Error(error.message);
}

/** Returns a live access token, refreshing (and storing the rotated refresh token) if needed. */
async function getAccess() {
  const conn = await getXeroConnection();
  if (!conn) throw new Error("Xero isn't connected yet. Connect it from Team dashboard → Xero.");

  if (new Date(conn.expires_at).getTime() > Date.now()) {
    return { token: conn.access_token as string, tenantId: conn.tenant_id as string };
  }

  // Xero rotates refresh tokens: the old one stops working once used, so the
  // new one must be saved before anything else can fail.
  const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refresh_token });
  const supabase = createServiceSupabase();
  const { error } = await supabase
    .from("xero_connection")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt(tokens.expires_in),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  return { token: tokens.access_token, tenantId: conn.tenant_id as string };
}

async function xeroApi<T>(method: "GET" | "PUT" | "POST", path: string, body?: unknown): Promise<T> {
  const { token, tenantId } = await getAccess();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Xero-tenant-id": tenantId,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Xero ${method} ${path} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

type XeroContact = { ContactID: string; Name: string };

/** Finds a Xero contact by exact name (so existing Xero customers are reused), else creates one. */
export async function findOrCreateContact(name: string, email: string | null): Promise<string> {
  const where = encodeURIComponent(`Name=="${name.replace(/"/g, '\\"')}"`);
  const found = await xeroApi<{ Contacts: XeroContact[] }>("GET", `/Contacts?where=${where}`);
  if (found.Contacts?.[0]) return found.Contacts[0].ContactID;

  const created = await xeroApi<{ Contacts: XeroContact[] }>("PUT", "/Contacts", {
    Contacts: [{ Name: name, ...(email ? { EmailAddress: email } : {}) }],
  });
  return created.Contacts[0].ContactID;
}

export type XeroInvoiceLine = { description: string; quantity: number; unitAmount: number };

/**
 * Creates a sales invoice (ACCREC). Defaults to DRAFT so staff review it in
 * Xero before approving/sending — Xero generates and sends the actual invoice,
 * BrandSource doesn't. Account code, GST treatment and status are env-driven
 * so the accountant's choices don't need a code change.
 */
export async function createInvoice(input: {
  contactId: string;
  reference: string | null;
  dueDate: string;
  lines: XeroInvoiceLine[];
}) {
  const accountCode = process.env.XERO_SALES_ACCOUNT_CODE || "200";
  const lineAmountTypes = process.env.XERO_LINE_AMOUNT_TYPES || "Inclusive";
  const status = process.env.XERO_INVOICE_STATUS || "DRAFT";

  const res = await xeroApi<{ Invoices: { InvoiceID: string; InvoiceNumber: string }[] }>("PUT", "/Invoices", {
    Invoices: [
      {
        Type: "ACCREC",
        Contact: { ContactID: input.contactId },
        Date: new Date().toISOString().slice(0, 10),
        DueDate: input.dueDate,
        Reference: input.reference ?? undefined,
        LineAmountTypes: lineAmountTypes,
        Status: status,
        LineItems: input.lines.map((l) => ({
          Description: l.description,
          Quantity: l.quantity,
          UnitAmount: l.unitAmount,
          AccountCode: accountCode,
        })),
      },
    ],
  });
  return res.Invoices[0];
}
