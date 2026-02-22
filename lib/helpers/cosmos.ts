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
