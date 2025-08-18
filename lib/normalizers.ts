// lib/normalizers.ts
/**
 * Helpers to map Steam store JSON into your DB fields.
 * Safe against missing fields; returns sensible fallbacks.
 */

/* ----------------------------- Types ----------------------------- */

/** Minimal shape we rely on from Steam appdetails */
export type SteamAppDetails = {
  name?: string;
  short_description?: string;

  header_image?: string;
  capsule_imagev5?: string;

  developers?: string[];
  publishers?: string[];

  release_date?: {
    date?: string | null;
    coming_soon?: boolean;
  };

  metacritic?: {
    score?: number | null;
    url?: string;
  };

  screenshots?: Array<{
    path_thumbnail?: string;
    path_full?: string;
  }>;

  genres?: Array<{ id?: string | number; description?: string }>;
  categories?: Array<{ id?: string | number; description?: string }>;

  platforms?: {
    windows?: boolean;
    mac?: boolean;
    linux?: boolean;
  };
};

/** Minimal shape we rely on from Steam reviews summary */
export type ReviewsSummary = {
  query_summary?: {
    review_score?: number;
    review_score_desc?: string;
    total_positive?: number;
    total_negative?: number;
    total_reviews?: number;
  };
};

/* --------------------------- Small utils -------------------------- */

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/** Force http:// → https:// for CDN assets */
const toHttps = (u?: string | null) =>
  u ? u.replace(/^http:\/\//i, "https://") : null;

/** Parse varied Steam release date strings safely into ISO string (or null) */
export function parseReleaseDate(raw?: string | null): string | null {
  if (!raw) return null;

  // Try native parse (covers "Oct 13, 2013", "13 Oct, 2013", "2023", etc.)
  const d1 = new Date(raw);
  if (!isNaN(d1.getTime())) return d1.toISOString();

  // Try MM/DD/YYYY
  const mmdd = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (mmdd) {
    const [, m, d, y] = mmdd;
    const d2 = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(d2.getTime())) return d2.toISOString();
  }

  // Try just year fallback
  const year = /^(\d{4})$/.exec(raw);
  if (year) {
    const y = Number(year[1]);
    const d3 = new Date(y, 0, 1);
    if (!isNaN(d3.getTime())) return d3.toISOString();
  }

  return null;
}

/* --------------------------- Normalizers -------------------------- */

export function normalizeGame(
  appId: number,
  details: SteamAppDetails,
  reviews: ReviewsSummary | null
) {
  const title = details.name ?? `app-${appId}`;
  const slug = slugify(title);
  const summary = details.short_description ?? null;

  const headerImageUrl = toHttps(details.header_image ?? null);
  const heroCapsuleUrl = toHttps(details.capsule_imagev5 ?? null);

  const developerName = details.developers?.[0] ?? null;
  const publisherName = details.publishers?.[0] ?? null;

  const releaseIso = parseReleaseDate(details.release_date?.date ?? null);

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

  const metacriticScore =
    typeof details.metacritic?.score === "number"
      ? details.metacritic.score
      : null;

  return {
    steamAppId: appId,
    title,
    slug,
    summary,
    headerImageUrl,
    heroCapsuleUrl,
    developerName,
    publisherName,
    releaseDate: releaseIso,
    metacriticScore,
    steamReviewLabel,
    steamReviewCount,
    steamReviewPercent,
  };
}

export function normalizeScreenshots(details: SteamAppDetails) {
  const shots = details.screenshots ?? [];
  return shots
    .map((s, idx) => {
      const full = toHttps(s.path_full ?? undefined);
      const thumb = toHttps(s.path_thumbnail ?? undefined);
      return {
        imageUrl: full ?? thumb ?? "",
        thumbnailUrl: thumb ?? null,
        sortIndex: idx,
      };
    })
    .filter((s) => !!s.imageUrl);
}

/* ----------------------- Taxonomy extractors ---------------------- */

export function extractTagNamesFromSteam(d: any): string[] {
  // Steam "genres": [{ id, description }]
  const fromGenres = (d?.genres ?? [])
    .map((g: any) => g?.description)
    .filter(Boolean);
  // You could also include categories here if you want them as tags.
  // const fromCategories = (d?.categories ?? [])
  //   .map((c: any) => c?.description)
  //   .filter(Boolean);
  // return dedupePreserveOrder([...fromGenres, ...fromCategories]);
  return fromGenres;
}

export function extractPlatformNamesFromSteam(d: any): string[] {
  // Steam "platforms": { windows, mac, linux }
  const p = d?.platforms ?? {};
  const out: string[] = [];
  if (p.windows) out.push("Windows");
  if (p.mac) out.push("Mac");
  if (p.linux) out.push("Linux");
  return out;
}

/* ------------------------- Canonical helpers ---------------------- */

export const canonical = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, " ");

export const uniqueCanonical = (names: string[]) =>
  Array.from(new Set(names.map(canonical)));

/* ---------------------------- Slugging ---------------------------- */

export function generateGameSlug(name: string, steamAppId: number): string {
  return `${slugify(name)}-${steamAppId}`;
}
