// lib/steam.ts
/**
 * Lightweight Steam fetch helpers for server-side use.
 * - fetchAppDetails(appId): Steam Store "appdetails" (metadata, images, genres, platforms)
 * - fetchReviewSummary(appId): Steam Store "appreviews" (aggregate review stats)
 *
 * No Steam Web API key is required for these two endpoints.
 */

type AppDetailsEnvelope = {
  success: boolean;
  data?: {
    name?: string;
    short_description?: string;
    header_image?: string;
    capsule_imagev5?: string;
    screenshots?: { path_thumbnail?: string; path_full?: string }[];
    developers?: string[];
    publishers?: string[];
    release_date?: { date?: string | null; coming_soon?: boolean };
    metacritic?: { score?: number | null };
    platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
    genres?: { id?: string; description?: string }[];
    categories?: { id?: string; description?: string }[];
  };
};

type ReviewsSummaryResponse = {
  success?: number;
  query_summary?: {
    review_score_desc?: string;
    total_reviews?: number;
    total_positive?: number;
  };
};

const APPDETAILS_BASE = "https://store.steampowered.com/api/appdetails";
const APPREVIEWS_BASE = "https://store.steampowered.com/appreviews";

/** Fetch with timeout helper */
async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  ms = 12_000
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      // Avoid caching at the edge in dev to see updates
      cache: "no-store",
      headers: {
        ...(opts.headers || {}),
        // Helps some CDNs return English fields (genres/categories)
        "accept-language": "en",
      },
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/** Get app details (metadata, images, platforms, genres) from Steam store */
export async function fetchAppDetails(appId: number) {
  const url = `${APPDETAILS_BASE}?appids=${appId}&l=en`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    throw new Error(`Steam appdetails HTTP ${res.status}`);
  }
  const json = (await res.json()) as Record<string, AppDetailsEnvelope>;
  const envelope = json[String(appId)];
  if (!envelope || !envelope.success || !envelope.data) {
    throw new Error(`Steam appdetails returned no data for appId=${appId}`);
  }
  return envelope.data;
}

/** Get aggregate review summary from Steam store */
export async function fetchReviewSummary(appId: number) {
  const url = `${APPREVIEWS_BASE}/${appId}?json=1&language=all&purchase_type=all`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    // Not fatal—some apps can block this; caller should tolerate nulls
    return null as ReviewsSummaryResponse | null;
  }
  const json = (await res.json()) as ReviewsSummaryResponse;
  return json;
}
