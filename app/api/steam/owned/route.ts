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
interface OwnedGame {
  appid: number;
}

// If fetchOwnedGames returns numbers or objects, normalize to { appid }.
function asOwned(list: unknown): OwnedGame[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((v: any) =>
      typeof v === "number" ? { appid: v } : { appid: Number(v?.appid) }
    )
    .filter((g) => Number.isFinite(g.appid));
}

/** Simple array chunker with proper typing */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
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
          await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i)));
          continue;
        }
        return res; // final attempt: return the 5xx so caller can read body
      }
      return res; // ok or 4xx (don’t retry 4xx)
    } catch (e) {
      lastErr = e;
      if (i === tries - 1) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Read response body safely (JSON or text) */
async function readBody(res: Response): Promise<{ text: string; json?: any }> {
  const ct = res.headers.get("content-type") || "";
  let text = "";
  try {
    text = await res.text();
  } catch {
    /* ignore */
  }
  if (ct.includes("application/json") && text) {
    try {
      return { text, json: JSON.parse(text) };
    } catch {
      /* fall through to text */
    }
  }
  return { text };
}

/**
 * Classify /api/steam/import responses that should count as SKIPPED
 * - Prefer status codes: 409 (already imported), 404/422 (no data/invalid)
 * - Fallback to message body heuristics
 */
function shouldSkip(status: number, bodyStr: string): boolean {
  if (status === 409 || status === 404 || status === 422) return true;
  const t = (bodyStr || "").toLowerCase();
  return (
    t.includes("no_appdetails") ||
    t.includes("appdetails returned no data") ||
    t.includes("returned no data for appid") ||
    t.includes("no data for appid")
  );
}

/**
 * GET /api/steam/owned?steamId=...&limit=50
 * - Requires STEAM_WEB_API_KEY (env) OR pass ?key= for local testing
 * - Imports up to `limit` owned games by calling /api/steam/import?appId=...
 * - Returns detailed summary: imported, skipped, errors
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Allow query overrides for local debugging (safe to remove later)
    const key = (searchParams.get("key") || process.env.STEAM_WEB_API_KEY || "").trim();
    const steamId = (searchParams.get("steamId") || process.env.STEAM_USER_ID || "").trim();

    if (!key) {
      return NextResponse.json({ error: "Missing STEAM_WEB_API_KEY" }, { status: 500 });
    }
    if (!steamId) {
      return NextResponse.json({ error: "Missing steamId" }, { status: 400 });
    }

    // Build a reliable origin (works in dev & prod)
    const hdrs = await headers();
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
    const fallbackOrigin = new URL(req.url).origin;
    const origin = host ? `${proto}://${host}` : fallbackOrigin;

    // Fetch owned games
    const limit = Math.max(1, Math.min(Number(searchParams.get("limit") || 50), 250));
    const ownedRaw = await fetchOwnedGames(steamId, key);
    const owned = asOwned(ownedRaw); // normalize to { appid }
    const slice = owned.slice(0, limit);
    const ownedRaw = await fetchOwnedGames(steamId, key);
    const owned = asOwned(ownedRaw).filter(g => !DO_NOT_IMPORT.has(g.appid));
    const slice = owned.slice(0, limit);

    // Process in small concurrent batches
    const concurrency = 5;
    const chunks = chunk(slice, concurrency);

    const imported: number[] = [];
    const skipped: number[] = [];
    const errors: Array<{ appId: number; status?: number; message: string }> = [];

    for (const group of chunks) {
      await Promise.all(
        group.map(async ({ appid }) => {
          const url = `${origin}/api/steam/import?appId=${appid}`;

          try {
            const res = await withRetryFetch(url, { cache: "no-store" });

            if (res.ok) {
              imported.push(appid);
              return;
            }

            const { text, json } = await readBody(res);
            const bodyStr =
              (json?.code as string) ||
              (json?.error as string) ||
              (json?.details as string) ||
              text ||
              "";

            if (shouldSkip(res.status, bodyStr)) {
              skipped.push(appid);
            } else {
              errors.push({ appId: appid, status: res.status, message: bodyStr || "Import failed" });
            }
          } catch (e: any) {
            errors.push({ appId: appid, message: String(e?.message || e) });
          }
        })
      );
    }

    return NextResponse.json(
      {
        totalOwned: owned.length,
        requested: limit,
        processed: slice.length,
        importedCount: imported.length,
        skippedCount: skipped.length,
        errorCount: errors.length,
        imported,
        skipped,
        errors,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Owned import failed", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
