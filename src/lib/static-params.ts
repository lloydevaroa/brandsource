/**
 * For generateStaticParams: pre-build pages when Supabase answers in time, and
 * pre-build none when it doesn't. A page not built here is built on its first
 * visit and then cached (dynamicParams is on and `revalidate` is set), so a slow
 * or failing database no longer fails the whole deploy.
 */
export async function staticParamsOrNone<T>(load: () => Promise<T[]>, timeoutMs = 30_000): Promise<T[]> {
  try {
    return await Promise.race([
      load(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`timed out after ${timeoutMs / 1000}s`)), timeoutMs),
      ),
    ]);
  } catch (err) {
    console.warn(`generateStaticParams skipped, pages will build on first visit: ${String(err)}`);
    return [];
  }
}
