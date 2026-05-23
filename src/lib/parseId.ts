/** Parse a route/query param as a positive integer. Returns null if invalid. */
export function parseId(value: string | undefined): number | null {
  const n = parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Escape ILIKE wildcard characters in a search string so that user-supplied
 * `%` and `_` are treated as literals rather than glob patterns.
 * Always pair with an `ESCAPE '\'` clause in the SQL:
 *   WHERE col ILIKE $1 ESCAPE '\'
 */
export function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
