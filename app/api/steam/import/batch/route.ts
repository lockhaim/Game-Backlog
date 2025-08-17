// app/api/steam/import/batch/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { DO_NOT_IMPORT } from "@/lib/denylist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type BatchReq = {
  appIds: number[];
  concurrency?: number; // default 8
};

type Result = {
  total: number;
  requested: number;
  processed: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  denylistedCount: number;
  imported: number[];
  skipped: number[];
  errors: Array<{ appId: number; status?: number; message: string }>;
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function dedupeNums(nums: number[]): number[] {
  return Array.from(new Set(nums));
}

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
        return res;
      }
      return res; // ok or 4xx
    } catch (e) {
      lastErr = e;
      if (i === tries - 1) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i)));
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
    t.includes("no data for appid") ||
    t.includes("denylisted_app") ||
    t.includes("denylisted_slug")
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<BatchReq>;
    const rawIds = Array.isArray(body.appIds) ? body.appIds : [];
    const appIds = dedupeNums(rawIds.filter(isFiniteNumber).filter((n) => n > 0));

    if (appIds.length === 0) {
      return NextResponse.json(
        { error: "Provide { appIds: number[] } with valid Steam app IDs." },
        { status: 400 }
      );
    }

    const concurrency = Math.max(1, Math.min(Number(body.concurrency ?? 8), 20));

    // Build origin to call our own import route
    const hdrs = await headers();
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
    const fallbackOrigin = new URL(req.url).origin;
    const origin = host ? `${proto}://${host}` : fallbackOrigin;

    // Apply denylist up-front
    const allowedIds = appIds.filter((id) => !DO_NOT_IMPORT.has(id));
    const denylistedCount = appIds.length - allowedIds.length;

    const imported: number[] = [];
    const skipped: number[] = [];
    const errors: Array<{ appId: number; status?: number; message: string }> = [];

    // Chunk by concurrency and process sequentially per chunk to limit pressure
    for (let i = 0; i < allowedIds.length; i += concurrency) {
      const group = allowedIds.slice(i, i + concurrency);
      await Promise.all(
        group.map(async (appId) => {
          const url = `${origin}/api/steam/import?appId=${appId}`;
          try {
            const res = await withRetryFetch(url, { cache: "no-store" });
            if (res.ok) {
              imported.push(appId);
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
              skipped.push(appId);
            } else {
              errors.push({
                appId,
                status: res.status,
                message: bodyStr || "Import failed",
              });
            }
          } catch (e: any) {
            errors.push({ appId, message: String(e?.message || e) });
          }
        })
      );
    }

    const result: Result = {
      total: appIds.length,
      requested: appIds.length,
      processed: allowedIds.length,
      importedCount: imported.length,
      skippedCount: skipped.length,
      errorCount: errors.length,
      denylistedCount,
      imported,
      skipped,
      errors,
    };

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Batch import failed", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}