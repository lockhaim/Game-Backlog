// lib/normalizers.ts
/**
 * Helpers to map Steam store JSON into your DB fields.
 * Safe against missing fields; returns sensible fallbacks.
 */

type Details = Awaited<ReturnType<typeof import("./steam").fetchAppDetails>>;
type Reviews = Awaited<ReturnType<typeof import("./steam").fetchReviewSummary>>;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/** Parse varied Steam release date strings safely into ISO string (or null) */
export function parseReleaseDate(raw?: string | null): string | null {
  if (!raw) return null;

  // Many Steam dates are like "Oct 13, 2013" or "13 Oct, 2013" or "2023"
  const d1 = new Date(raw);
  if (!isNaN(d1.getTime())) return d1.toISOString();

  // Try MM/DD/YYYY
  const mmdd = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (mmdd) {
    const [_, m, d, y] = mmdd;
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

export function normalizeGame(appId: number, details: Details, reviews: Reviews | null) {
  const title = details.name ?? `app-${appId}`;
  const slug = slugify(title);
  const summary = details.short_description ?? null;

  const headerImageUrl = details.header_image ?? null;
  const heroCapsuleUrl = details.capsule_imagev5 ?? null;

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
    steamReviewPercent =
      total > 0 ? Math.round((positive / total) * 100) : null;
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
    releaseDate: releaseIso,
    metacriticScore,
    steamReviewLabel,
    steamReviewCount,
    steamReviewPercent,
  };
}

export function normalizeScreenshots(details: Details) {
  const shots = details.screenshots ?? [];
  return shots.map((s, idx) => ({
    imageUrl: s.path_full ?? s.path_thumbnail ?? "",
    thumbnailUrl: s.path_thumbnail ?? null,
    sortIndex: idx,
  })).filter(s => !!s.imageUrl);
}

export function normalizeTags(details: Details) {
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

export function normalizePlatforms(details: Details) {
  const p = details.platforms ?? {};
  const out: string[] = [];
  if (p.windows) out.push("PC");
  if (p.mac) out.push("Mac");
  if (p.linux) out.push("Linux");
  return out;
}
