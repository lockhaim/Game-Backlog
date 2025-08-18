// lib/steam.ts

/**
 * Steam API helpers. Resilient to age gate (403) and flakiness:
 * - Realistic headers + optional mature-content cookies
 * - Multiple attempts: filtered/unfiltered, with/without cookies
 * - Final delayed retry if still 403
 * - Returns a consistent envelope keyed by appId string
 */

type AnyObj = Record<string, any>;

const STORE_BASE = "https://store.steampowered.com/api/appdetails";
const REVIEWS_BASE = "https://store.steampowered.com/appreviews";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ua() {
  return (
    process.env.STEAM_USER_AGENT ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
}

// Keep this as a plain object, not Headers/HeadersInit, so TS doesn't add array-like properties.
const baseHeaders: Record<string, string> = {
  "User-Agent": ua(),
  Accept: "application/json, text/plain, */*",
  Referer: "https://store.steampowered.com/",
  "Accept-Language": "en-US,en;q=0.9",
};

// Build headers per attempt; return a plain object which is valid as HeadersInit.
function makeHeaders(withCookies: boolean): Record<string, string> {
  const h: Record<string, string> = {
    ...baseHeaders,
    // Fetch hints (not strictly required; helps mimic a browser)
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Dest": "document",
  };
  if (withCookies) {
    // Bypass age/mature gates commonly used by the store
    h["Cookie"] = [
      "birthtime=0",
      "lastagecheckage=1-January-1970",
      "mature_content=1",
      "wants_mature_content=1",
    ].join("; ");
  }
  return h;
}

async function getText(
  url: string,
  headers: HeadersInit
): Promise<{ status: number; text: string }> {
  const res = await fetch(url, { headers, cache: "no-store" });
  const text = await res.text().catch(() => "");
  return { status: res.status, text };
}

function tryParseJSON<T = any>(s: string): T | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Primary fetch for appdetails with filters; multiple fallbacks if needed.
 * Returns an "envelope" keyed by the appId string:
 * { "570": { success: true, data: { ... } } }
 */
export async function fetchAppDetails(
  appId: number,
  opts?: { cc?: string; lang?: string }
): Promise<AnyObj> {
  const cc = (opts?.cc || "US").toUpperCase();
  const lang = opts?.lang || "english";
  const id = String(appId);

  const filteredParams =
    `appids=${encodeURIComponent(id)}` +
    `&l=${encodeURIComponent(lang)}` +
    `&cc=${encodeURIComponent(cc)}` +
    `&filters=basic,genres,categories,release_date,platforms,metacritic,screenshots,header_image,capsule_imagev5`;

  const fullParams =
    `appids=${encodeURIComponent(id)}` +
    `&l=${encodeURIComponent(lang)}` +
    `&cc=${encodeURIComponent(cc)}`;

  // Attempt matrix:
  // 1) filtered, no cookies
  // 2) full, no cookies
  // 3) filtered, with cookies (age/mature)
  // 4) full, with cookies
  const attempts = [
    { url: `${STORE_BASE}?${filteredParams}`, cookies: false },
    { url: `${STORE_BASE}?${fullParams}`, cookies: false },
    { url: `${STORE_BASE}?${filteredParams}`, cookies: true },
    { url: `${STORE_BASE}?${fullParams}`, cookies: true },
  ];

  let last = { status: 0, text: "" };

  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i];
    const url = `${a.url}&v=${Date.now()}`; // vary query to avoid weird caches
    last = await getText(url, makeHeaders(a.cookies));
    const j = tryParseJSON<AnyObj>(last.text);
    const e = j && typeof j === "object" ? j[id] : null;

    if (e && (typeof e.success === "boolean" || e?.data)) {
      return j!;
    }

    // Backoffs: 403 often means age/anti-bot; 5xx is server flake
    if (last.status === 403) {
      await sleep(1200 + Math.floor(Math.random() * 400));
    } else if (last.status >= 500) {
      await sleep(400);
    }
  }

  // Final extra try if still 403: delay + full + cookies
  if (last.status === 403) {
    await sleep(1500);
    const finalUrl = `${STORE_BASE}?${fullParams}&v=${Date.now()}`;
    const r = await getText(finalUrl, makeHeaders(true));
    const j = tryParseJSON<AnyObj>(r.text);
    const e = j && typeof j === "object" ? j[id] : null;
    if (e && (typeof e.success === "boolean" || e?.data)) {
      return j!;
    }
    return {
      [id]: {
        success: false,
        data: null,
        _debug: {
          status1: last.status,
          status2: r.status,
          isJson1: false,
          isJson2: !!j,
          hasKey1: false,
          hasKey2: !!e,
          len1: last.text.length,
          len2: r.text.length,
        },
      },
    };
  }

  // Generic failure envelope
  return {
    [id]: {
      success: false,
      data: null,
      _debug: {
        status1: last.status,
        status2: 0,
        isJson1: false,
        isJson2: false,
        hasKey1: false,
        hasKey2: false,
        len1: last.text.length,
        len2: 0,
      },
    },
  };
}

/**
 * Lightweight review summary. Safe if Steam is flaky (returns null on failure).
 * You can adjust params (e.g., language=all, purchase_type=all).
 */
export async function fetchReviewSummary(appId: number): Promise<{
  query_summary?: {
    total_reviews?: number;
    total_positive?: number;
    review_score?: number;
    review_score_desc?: string;
  };
} | null> {
  const url =
    `${REVIEWS_BASE}/${encodeURIComponent(String(appId))}?` +
    `json=1&language=all&purchase_type=all&num_per_page=0`;

  try {
    const r = await getText(url, makeHeaders(false));
    if (r.status >= 400) return null;
    const j = tryParseJSON<AnyObj>(r.text);
    if (!j || typeof j !== "object") return null;
    return j;
  } catch {
    return null;
  }
}
