// app/api/steam/owned/route.ts
import { NextResponse } from "next/server";
import { fetchOwnedGames } from "@/lib/steamOwned";
import { DO_NOT_IMPORT } from "@/lib/denylist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch with simple retry for 5xx; returns final 5xx so caller can read body */
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
        return res;
      }
      return res; // ok or 4xx (don’t retry 4xx)
    } catch (e) {
      lastErr = e;
      if (i === tries - 1) break;
      await sleep(baseDelayMs * Math.pow(2, i));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function readBody(res: Response): Promise<{ text: string; json?: any }> {
  const ct = res.headers.get("content-type") || "";
  let text = "";
  try {
    text = await res.text();
  } catch {}
  if (ct.includes("application/json") && text) {
    try {
      return { text, json: JSON.parse(text) };
    } catch {}
  }
  return { text };
}

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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const key = (searchParams.get("key") || process.env.STEAM_WEB_API_KEY || "").trim();
    const steamId = (searchParams.get("steamId") || process.env.STEAM_USER_ID || "").trim();
    if (!key) return NextResponse.json({ error: "Missing STEAM_WEB_API_KEY" }, { status: 500 });
    if (!steamId) return NextResponse.json({ error: "Missing steamId" }, { status: 400 });

    // Tuning params
    const limit = Math.max(1, Math.min(Number(searchParams.get("limit") || 50), 250));
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));
    const concurrency = Math.max(1, Math.min(Number(searchParams.get("concurrency") || 3), 10));
    const groupDelayMs = Math.max(0, Math.min(Number(searchParams.get("delay") || 400), 5000));
    const backoffMs = Math.max(1000, Math.min(Number(searchParams.get("backoff") || 4000), 30000));

    // Build a reliable origin (works in dev & prod) — use the request headers (no next/headers)
    const hdrs = req.headers;
    const proto =
      hdrs.get("x-forwarded-proto") ??
      (process.env.VERCEL ? "https" : "http");
    const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
    const fallbackOrigin = new URL(req.url).origin;
    const origin = host ? `${proto}://${host}` : fallbackOrigin;

    // Fetch / normalize owned list
    const ownedRaw = await fetchOwnedGames(steamId, key);
    const allOwned = asOwned(ownedRaw);
    const eligibleOwned = allOwned.filter((g) => !DO_NOT_IMPORT.has(g.appid));

    // Apply offset/limit window
    const window = eligibleOwned.slice(offset, offset + limit);

    // Process in chunk groups of size = concurrency
    const groups = chunk(window, concurrency);

    const imported: number[] = [];
    const skipped: number[] = [];
    const errors: Array<{ appId: number; status?: number; message: string }> = [];

    let skipNoDetails = 0;
    let skipAlready = 0;
    let skipOther = 0;

    for (const group of groups) {
      // Run this group in parallel
      let groupNoDetails = 0;

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
            const code = (json?.code as string) || "";
            const bodyStr =
              code ||
              (json?.error as string) ||
              (json?.details as string) ||
              text ||
              "";

            if (shouldSkip(res.status, bodyStr)) {
              skipped.push(appid);
              if (code === "NO_APPDETAILS") {
                skipNoDetails++;
                groupNoDetails++;
              } else if (res.status === 409 || code === "P2002") {
                skipAlready++;
              } else {
                skipOther++;
              }
            } else {
              errors.push({ appId: appid, status: res.status, message: bodyStr || "Import failed" });
            }
          } catch (e: any) {
            errors.push({ appId: appid, message: String(e?.message || e) });
          }
        })
      );

      // If this chunk mostly failed with NO_APPDETAILS (likely 403s), back off more.
      const ratio = group.length ? groupNoDetails / group.length : 0;
      if (ratio >= 0.5) {
        await sleep(backoffMs + Math.floor(Math.random() * 500));
      } else if (groupDelayMs > 0) {
        await sleep(groupDelayMs);
      }
    }

    const nextOffset = offset + limit;
    const hasMore = nextOffset < eligibleOwned.length;

    return NextResponse.json(
      {
        limit,
        offset,
        nextOffset,
        hasMore,
        totalOwned: allOwned.length,
        eligibleOwned: eligibleOwned.length,
        denylistedCount: allOwned.length - eligibleOwned.length,
        processed: window.length,
        importedCount: imported.length,
        skippedCount: skipped.length,
        errorCount: errors.length,
        imported,
        skipped,
        errors,
        skipBreakdown: {
          ALREADY_IMPORTED: skipAlready,
          NO_APPDETAILS: skipNoDetails,
          SKIP_OTHER: skipOther,
        },
        skipSamples: {
          ALREADY_IMPORTED: [],
          NO_APPDETAILS: skipped
            .slice(-Math.min(skipped.length, 8))
            .map((appId) => ({ appId, status: 422, message: "NO_APPDETAILS" })),
          SKIP_OTHER: [],
        },
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
