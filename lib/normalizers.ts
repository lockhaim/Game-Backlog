// lib/normalizers.ts
/**
 * Helpers to map Steam store JSON into your DB fields.
 * Types are intentionally minimal and optional to tolerate missing fields.
 */

// ---------- Minimal shapes (no dynamic imports) ----------
// lib/normalizers.ts

export interface SteamAppDetails {
  name?: string | null;
  short_description?: string | null;
  header_image?: string | null;
  capsule_imagev5?: string | null;

  developers?: (string | null)[] | null;
  publishers?: (string | null)[] | null;

  // Steam sometimes includes `coming_soon`, and `date` can be null
  release_date?: { date?: string | null; coming_soon?: boolean | null } | null;

  // `score` can be null in some responses
  metacritic?: { score?: number | null } | null;

  screenshots?:
    | { path_full?: string | null; path_thumbnail?: string | null }[]
    | null;

  genres?:
    | { id?: string | number | null; description?: string | null }[]
    | null;

  categories?:
    | { id?: string | number | null; description?: string | null }[]
    | null;

  platforms?: { windows?: boolean | null; mac?: boolean | null; linux?: boolean | null } | null;
}


export interface ReviewsSummary {
  query_summary?: {
    review_score_desc?: string;
    total_reviews?: number;
    total_positive?: number;
  };
}

// ---------- General helpers ----------
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/** Ensure uniqueness across same-titled games by including appId. */
export function generateGameSlug(name: string, steamAppId: number): string {
  return `${slugify(name)}-${steamAppId}`;
}

/** Parse varied Steam release date strings safely into Date (or null). */
export function parseReleaseDate(raw?: string | null): Date | null {
  if (!raw) return null;

  // Many Steam dates are like "Oct 13, 2013" or "13 Oct, 2013" or "2023"
  const d1 = new Date(raw);
  if (!isNaN(d1.getTime())) return d1;

  // Try MM/DD/YYYY
  const mmdd = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (mmdd) {
    const [, m, d, y] = mmdd;
    const d2 = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(d2.getTime())) return d2;
  }

  // Try just year fallback
  const year = /^(\d{4})$/.exec(raw);
  if (year) {
    const y = Number(year[1]);
    const d3 = new Date(y, 0, 1);
    if (!isNaN(d3.getTime())) return d3;
  }

  return null;
}

// ---------- Normalizers (DB-facing shapes) ----------
export function normalizeGame(
  appId: number,
  details: SteamAppDetails,
  reviews: ReviewsSummary | null
) {
  const title = details.name ?? `app-${appId}`;
  // Append appId to prevent unique slug collisions
  const slug = generateGameSlug(title, appId);
  const summary = details.short_description ?? null;

  const headerImageUrl = details.header_image ?? null;
  const heroCapsuleUrl = details.capsule_imagev5 ?? null;

  const developerName = Array.isArray(details.developers) ? details.developers[0] ?? null : details.developers ?? null;
  const publisherName = Array.isArray(details.publishers) ? details.publishers[0] ?? null : details.publishers ?? null;

  const releaseDate = parseReleaseDate(details.release_date?.date ?? null);

  // Reviews aggregate
  let steamReviewLabel: string | null = null;
  let steamReviewCount: number | null = null;
  let steamReviewPercent: number | null = null;
  if (reviews?.query_summary) {
    const qs = reviews.query_summary;
    steamReviewLabel = qs.review_score_desc ?? null;
    const total = qs.total_reviews ?? 0;
    const positive = qs.total_positive ?? 0;
    steamReviewCount = total || null;
    steamReviewPercent = total > 0 ? Math.round((positive / total) * 100) : null;
  }

  const metacriticScore = details.metacritic?.score ?? null;

  return {
    steamAppId: appId,
    title,
    slug,
    summary,
    headerImageUrl,
    heroCapsuleUrl,
    developerName,
    publisherName,
    releaseDate,           // Date | null (matches Prisma DateTime?)
    metacriticScore,
    steamReviewLabel,
    steamReviewCount,
    steamReviewPercent,
  };
}

export function normalizeScreenshots(details: SteamAppDetails) {
  const shots = details.screenshots ?? [];
  return shots
    .map((s, idx) => ({
      imageUrl: s.path_full ?? s.path_thumbnail ?? "",
      thumbnailUrl: s.path_thumbnail ?? null,
      sortIndex: idx,
    }))
    .filter((s) => !!s.imageUrl);
}

export function normalizeTags(details: SteamAppDetails) {
  const genres = (details.genres ?? []).map((g) => g.description).filter(Boolean);
  const categories = (details.categories ?? []).map((c) => c.description).filter(Boolean);
  // Deduplicate while preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of [...genres, ...categories]) {
    const name = String(n).trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

export function normalizePlatforms(details: SteamAppDetails) {
  const p = details.platforms ?? {};
  const out: string[] = [];
  if (p.windows) out.push("Windows"); // keep consistent with extractPlatformNamesFromSteam
  if (p.mac) out.push("Mac");
  if (p.linux) out.push("Linux");
  return out;
}

// ---------- Canonicalizers ----------
export const canonical = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
export const uniqueCanonical = (names: string[]) => Array.from(new Set(names.map(canonical)));

// ---------- “Extract” wrappers (kept for existing imports) ----------
export function extractTagNamesFromSteam(d: SteamAppDetails): string[] {
  return normalizeTags(d);
}

export function extractPlatformNamesFromSteam(d: SteamAppDetails): string[] {
  return normalizePlatforms(d);
}
