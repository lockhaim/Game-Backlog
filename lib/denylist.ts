// lib/denylist.ts

/** Deny specific Steam app IDs from being imported. */
export const DO_NOT_IMPORT = new Set<number>([
  // 1523, // example
]);

/** Deny specific game slugs from being imported (e.g., dupes/test titles). */
export const DO_NOT_IMPORT_SLUGS = new Set<string>([
  // "some-game-slug",
]);

/** Optional helpers */
export const isDenylistedAppId = (appId: number) => DO_NOT_IMPORT.has(appId);
export const isDenylistedSlug = (slug: string) => DO_NOT_IMPORT_SLUGS.has(slug);
