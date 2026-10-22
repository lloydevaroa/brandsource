import { createClient } from "@supabase/supabase-js";

/**
 * How long a database request may take before we give up and show the visitor a
 * friendly error instead of a page that hangs. Only data (PostgREST) calls are
 * limited; storage uploads and auth are left alone because they can be slow
 * for legitimate reasons (large artwork files).
 */
const DATA_TIMEOUT_MS = 6_000;

const fetchWithDataTimeout: typeof fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes("/rest/v1/")) return fetch(input, init);
  const timeout = AbortSignal.timeout(DATA_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
};

/** Service role — server only. Never expose to the browser. */
export function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase server env vars");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithDataTimeout },
  });
}
