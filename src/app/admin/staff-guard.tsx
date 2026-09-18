import Link from "next/link";
import { syncCurrentProfile, type Profile } from "@/lib/supabase/profile";

function Guard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}

/** Shared admin-page gate: Clerk configured, signed in, and staff role. */
export async function requireStaffProfile(
  title: string
): Promise<{ profile: Profile } | { guard: React.ReactElement }> {
  const hasClerk =
    Boolean(process.env.CLERK_SECRET_KEY) && Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  if (!hasClerk) {
    return {
      guard: (
        <Guard title={title}>
          <p className="mt-2 text-zinc-600">Clerk is not configured on this deployment yet.</p>
        </Guard>
      ),
    };
  }

  const profile = await syncCurrentProfile();
  if (!profile) {
    return {
      guard: (
        <Guard title={title}>
          <p className="mt-2 text-zinc-600">
            <Link href="/sign-in" className="underline">
              Sign in
            </Link>{" "}
            to continue.
          </p>
        </Guard>
      ),
    };
  }

  if (profile.role !== "admin" && profile.role !== "manager") {
    return {
      guard: (
        <Guard title={title}>
          <p className="mt-2 text-zinc-600">
            Your account doesn&apos;t have staff access. Ask an admin to set your role in Clerk.
          </p>
        </Guard>
      ),
    };
  }

  return { profile };
}
