import Link from "next/link";

export default async function AccountPage() {
  const clerkEnabled = Boolean(process.env.CLERK_SECRET_KEY);

  if (!clerkEnabled) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Home
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Your account</h1>
        <p className="mt-2 text-zinc-600">
          Clerk keys not configured yet — sign-in lands once env vars are set.
        </p>
      </div>
    );
  }

  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  const user = await currentUser();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Home
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Your account</h1>
      <p className="mt-2 text-zinc-600">
        Signed in as {user?.primaryEmailAddress?.emailAddress ?? userId}.
      </p>
      <p className="mt-6 text-sm text-zinc-500">
        Quotes, orders, invoices, and reorders land here once Supabase order
        tables are wired to this Clerk user.
      </p>
    </div>
  );
}
