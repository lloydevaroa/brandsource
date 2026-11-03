/**
 * Supabase returns at most 1000 rows per request, however many match, and says nothing when it
 * cuts the list short. Use this for any select that can grow past that (products and their
 * links): `build` returns the query for one slice, with a stable order so slices don't overlap.
 *
 *   const { data, error } = await fetchAll((from, to) =>
 *     supabase.from("products").select("name").order("name").order("slug").range(from, to));
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<{ data: T[]; error: null } | { data: null; error: { message: string } }> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await build(from, from + pageSize - 1);
    if (page.error) return { data: null, error: page.error };
    const got = page.data ?? [];
    rows.push(...got);
    if (got.length < pageSize) return { data: rows, error: null };
  }
}
