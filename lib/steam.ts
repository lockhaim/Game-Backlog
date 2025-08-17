// lib/steam.ts

// Minimal internal helper
type AnyObj = Record<string, any>;

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch Steam appdetails for a single appId.
 * Returns a flat shape:
 *   { success: boolean, data: object | null }
 * Never throws when the app has no data; callers can decide to skip.
 */
export async function fetchAppDetails(
  appId: number
): Promise<{ success: boolean; data: any | null }> {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=en`;

  const json = await fetchJson(url);
  if (!json || typeof json !== "object") {
    return { success: false, data: null };
  }

  // Typical Steam shape: { "12345": { success: boolean, data?: {...} } }
  const entry = (json as AnyObj)[String(appId)];

  // A) Envelope entry with { success, data }
  if (entry && typeof entry === "object" && "success" in entry) {
    return { success: !!entry.success, data: entry.data ?? null };
  }

  // B) Some wrappers return a flat { success, data }
  if ("success" in (json as AnyObj)) {
    const flat = json as AnyObj;
    return { success: !!flat.success, data: flat.data ?? null };
  }

  // C) Some wrappers return the details object directly
  const maybeDetails = entry ?? json;
  if (
    maybeDetails &&
    typeof maybeDetails === "object" &&
    (
      typeof (maybeDetails as AnyObj).name === "string" ||
      typeof (maybeDetails as AnyObj).short_description === "string" ||
      (maybeDetails as AnyObj).release_date
    )
  ) {
    return { success: true, data: maybeDetails };
  }

  // No usable data
  return { success: false, data: null };
}

/**
 * Fetch a lightweight reviews summary for an app.
 * Returns the raw Steam response (which typically contains `query_summary`)
 * or null on failure. Never throws.
 *
 * Shape example:
 * {
 *   "success": 1,
 *   "query_summary": {
 *     "total_reviews": 1234,
 *     "total_positive": 1000,
 *     "review_score_desc": "Very Positive",
 *     ...
 *   }
 * }
 */
export async function fetchReviewSummary(appId: number): Promise<any | null> {
  // Request 0 reviews per page to get summary only.
  const url =
    `https://store.steampowered.com/appreviews/${appId}` +
    `?json=1&language=all&purchase_type=all&num_per_page=0&filter=summary`;

  const json = await fetchJson(url);
  if (!json || typeof json !== "object") return null;

  // Steam returns success: 1 on OK
  if (typeof (json as AnyObj).success === "number" || typeof (json as AnyObj).success === "boolean") {
    return json;
  }

  return null;
}
