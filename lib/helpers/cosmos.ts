/**
 * Removes Azure Cosmos DB system fields (those prefixed with `_`) from a document,
 * plus any additional keys specified in `extraKeys`.
 *
 * @param document - The Cosmos DB document to clean.
 * @param extraKeys - Additional property names to remove (e.g. `['id', 'ttl']`).
 *
 * @example
 * const clean = stripCosmosFields(doc, ['ttl']);
 * // Removes _rid, _self, _etag, _attachments, _ts, and ttl
 */
export function stripCosmosFields<T extends Record<string, unknown>>(
  document: T,
  extraKeys: string[] = [],
): Partial<T> {
  const excluded = new Set(extraKeys);
  return Object.fromEntries(
    Object.entries(document).filter(
      ([key]) => !key.startsWith('_') && !excluded.has(key),
    ),
  ) as Partial<T>;
}
