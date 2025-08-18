// app/api/steam/owned/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { fetchOwnedGames } from "@/lib/steamOwned";
import { DO_NOT_IMPORT } from "@/lib/denylist";

// --- Force Node runtime (Prisma + process.env) ---
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0; // Always fresh, no caching

// Minimal shape of a Steam "owned games" item.
interface OwnedGame { appid: number; }

// If fetchOwnedGames returns numbers or objects, normalize to { appid }.
function asOwned(list: unknown): OwnedGame[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((v: any) => (typeof v === "number" ? { appid: v } : { appid: Number(v?.appid) }))
    .filter((g) => Number.isFinite(g.appid));
}

/** Simple array chunker with proper typing */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Sleep helper */
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Retry wrapper for transient 5xx/network errors, returns final 5xx to caller */
async function withRetryFetch(
  url: string,
  init?: RequestInit,
  tries = 3,
  baseDelayMs = 250
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500) {
        if (i < tries - 1) {
          await sleep(baseDelayMs * Math.pow(2, i));
          continue;
        }
        return res; // final attempt: return the 5xx so caller can read body
      }
      return res; // ok or 4xx (don’t retry 4xx here)
    } catch (e) {
      lastErr = e;
      if (i === tries - 1) break;
      await sleep(baseDelayMs * Math.pow(2, i));
    }
  }
  throw (lastErr instanceof Error ? lastErr : new Error(String(lastErr)));
}

/** Read response body safely (JSON or text) */
async function readBody(res: Response): Promise<{ text: string; json?: any }> {
  const ct = res.headers.get("content-type") || "";
  let text = "";
  try { text = await res.text(); } catch {}
  if (ct.includes("application/json") && text) {
    try { return { text, json: JSON.parse(text) }; } catch {}
  }
  return { text };
}

/** Classify /api/steam/import responses that should count as SKIPPED */
function skipReason(
  status: number,
  bodyStr: string
): "ALREADY_IMPORTED" | "NO_APPDETAILS" | "SKIP_OTHER" | null {
  if (status === 409) return "ALREADY_IMPORTED";   // Prisma P2002 etc.
  if (status === 404 || status === 422) return "NO_APPDETAILS";
  const t = (bodyStr || "").toLowerCase();
  if (
    t.includes("no_appdetails") ||
    t.includes("appdetails returned no data") ||
    t.includes("returned no data for appid") ||
    t.includes("no data for appid")
  ) return "NO_APPDETAILS";
  return null;
}

/**
 * GET /api/steam/owned?steamId=...&limit=250&offset=0&verbose=1&concurrency=2&itemDelayMs=350&pageDelayMs=1000
 * - Imports a page of owned games by calling /api/steam/import?appId=...
 * - Returns summary + paging; with verbose=1 includes reason breakdown + debug samples
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Allow query overrides for local debugging (safe to remove later)
    const key = (searchParams.get("key") || process.env.STEAM_WEB_API_KEY || "").trim();
    const steamId = (searchParams.get("steamId") || process.env.STEAM_USER_ID || "").trim();

    if (!key) return NextResponse.json({ error: "Missing STEAM_WEB_API_KEY" }, { status: 500 });
    if (!steamId) return NextResponse.json({ error: "Missing steamId" }, { status: 400 });

    const limit = Math.max(1, Math.min(Number(searchParams.get("limit") || 250), 250));
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));
    const verbose = searchParams.get("verbose") === "1";
    const concurrency = Math.max(1, Math.min(Number(searchParams.get("concurrency") || 5), 10));
    const itemDelayMs = Math.max(0, Number(searchParams.get("itemDelayMs") || 0));  // per-item delay
    const pageDelayMs = Math.max(0, Number(searchParams.get("pageDelayMs") || 0));  // after each page

    // Build a reliable origin (works in dev & prod)
    const hdrs = await headers();
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
    const fallbackOrigin = new URL(req.url).origin;
    const origin = host ? `${proto}://${host}` : fallbackOrigin;

    // Fetch and normalize owned games
    const ownedRaw = await fetchOwnedGames(steamId, key);
    const ownedAll = asOwned(ownedRaw);

    // Apply denylist BEFORE slicing
    const owned = ownedAll.filter((g) => !DO_NOT_IMPORT.has(g.appid));
    const denylistedCount = ownedAll.length - owned.length;

    // Page slice
    const page = owned.slice(offset, offset + limit);
    const processed = page.length;
    const nextOffset = offset + processed;
    const hasMore = nextOffset < owned.length;

    // Process in concurrent batches
    const groups = chunk(page, concurrency);

    const imported: number[] = [];
    const skipped: number[] = [];
    const errors: Array<{ appId: number; status?: number; message: string }> = [];

    // Verbose tracking
    const skipBreakdown: Record<string, number> = { ALREADY_IMPORTED: 0, NO_APPDETAILS: 0, SKIP_OTHER: 0 };
    const samples: {
      [k: string]: Array<{ appId: number; status?: number; message: string; debug?: any }>;
    } = { ALREADY_IMPORTED: [], NO_APPDETAILS: [], SKIP_OTHER: [] };

    const importUrl = (appid: number, withDebug: boolean) =>
      `${origin}/api/steam/import?appId=${appid}${withDebug && verbose ? "&debug=1" : ""}`;

    for (const group of groups) {
      await Promise.all(
        group.map(async ({ appid }) => {
          const url = importUrl(appid, true); // send debug on first pass if verbose

          const handleOnce = async (theUrl: string): Promise<{ classified: boolean }> => {
            const res = await withRetryFetch(theUrl, { cache: "no-store" });
            if (res.ok) { imported.push(appid); return { classified: true }; }

            const { text, json } = await readBody(res);
            const bodyStr =
              (json?.code as string) ||
              (json?.error as string) ||
              (json?.details as string) ||
              text || "";

            const reason = skipReason(res.status, bodyStr);
            if (reason) {
              skipped.push(appid);
              skipBreakdown[reason] = (skipBreakdown[reason] ?? 0) + 1;

              if (verbose && samples[reason].length < 8) {
                samples[reason].push({
                  appId: appid,
                  status: res.status,
                  message: bodyStr,
                  debug: json?.debug ?? undefined,
                });
              }
              return { classified: true };
            }

            errors.push({ appId: appid, status: res.status, message: bodyStr || "Import failed" });
            return { classified: true };
          };

          try {
            const r = await handleOnce(url);

            // If we classified as NO_APPDETAILS, try a quick second attempt after a short delay
            if (r.classified) {
              // no-op; already recorded as imported/skipped/errors
            }

            if (itemDelayMs > 0) await sleep(itemDelayMs);
          } catch (e: any) {
            errors.push({ appId: appid, message: String(e?.message || e) });
          }
        })
      );

      // Optional delay between groups/pages to be polite to Steam
      if (pageDelayMs > 0) await sleep(pageDelayMs);
    }

    const payload: any = {
      // paging info
      limit,
      offset,
      nextOffset,
      hasMore,

      // counts
      totalOwned: ownedAll.length,
      eligibleOwned: owned.length,
      denylistedCount,

      // this page
      processed,
      importedCount: imported.length,
      skippedCount: skipped.length,
      errorCount: errors.length,

      // details
      imported,
      skipped,
      errors,
    };

    if (verbose) {
      payload.skipBreakdown = skipBreakdown;
      payload.skipSamples = samples;
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Owned import failed", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
