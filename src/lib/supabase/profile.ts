import { auth, currentUser } from "@clerk/nextjs/server";
import { createServiceSupabase } from "@/lib/supabase/server";
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
 * Upserts the signed-in Clerk user into `profiles` and returns the row.
 * Role comes from Clerk publicMetadata.role (set manually in the Clerk
 * dashboard for staff — no self-serve signup grants admin/manager).
 */
export async function syncCurrentProfile(): Promise<Profile | null> {
  const { userId } = await auth();
  if (!userId) return null;

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
}
