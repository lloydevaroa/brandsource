/** Shared by the header type-ahead and the /search results page. */

export function searchTokens(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Every word typed must appear somewhere in the text. */
export function matchesAll(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const hay = text.toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

/** Lower is better: name starts with the query, then name contains it, then description only. */
export function searchRank(name: string, tokens: string[], q: string): number {
  const n = name.toLowerCase();
  if (n.startsWith(q.trim().toLowerCase())) return 0;
  if (matchesAll(n, tokens)) return 1;
  return 2;
}
