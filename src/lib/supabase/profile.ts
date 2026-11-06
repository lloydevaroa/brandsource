import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { ttlCache } from "@/lib/ttl-cache";
import type { Role } from "@/lib/types";

export type Profile = {
  id: string;
  clerk_user_id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  client_id: string | null;
};

/**
 * The work behind syncCurrentProfile: ask Clerk for the user, then write their row to the database.
 * Two remote calls, about a second between them, so it is remembered per signed-in user for
 * PROFILE_TTL_MS on each server. A role change made in Clerk (or a login linked to a client) can
 * therefore take up to that long to show.
 */
const PROFILE_TTL_MS = 30_000;
const loadProfile = ttlCache(PROFILE_TTL_MS, async (userId: string): Promise<Profile | null> => {
  const user = await currentUser();
  if (!user) return null;

  const metadataRole = user.publicMetadata?.role;
  const role: Role =
    metadataRole === "admin" || metadataRole === "manager" ? metadataRole : "customer";

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        clerk_user_id: userId,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        full_name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
        role,
      },
      { onConflict: "clerk_user_id" }
    )
    .select("id, clerk_user_id, email, full_name, role, client_id")
    .single();

  if (error) throw error;
  return data;
});

/**
 * Upserts the signed-in Clerk user into `profiles` and returns the row.
 * Role comes from Clerk publicMetadata.role (set manually in the Clerk
 * dashboard for staff — no self-serve signup grants admin/manager).
 * Called from several places in one request (page, layout pieces, helpers), so it is shared per request.
 */
export const syncCurrentProfile = cache(async (): Promise<Profile | null> => {
  const { userId } = await auth();
  if (!userId) return null;
  return loadProfile(userId);
});
