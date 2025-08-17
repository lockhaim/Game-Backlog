// app/api/steam/reimport/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ImportResult =
  | { appId: number; status: "imported" }
  | { appId: number; status: "skipped" }
  | { appId: number; status: "error"; message: string };

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
        return res; // return final 5xx so caller can read the body
      }
      return res; // ok or 4xx (don’t retry 4xx)
    } catch (e) {
      lastErr = e;
      if (i === tries - 1) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i)));
    }
  }
  throw (lastErr instanceof Error ? lastErr : new Error(String(lastErr)));
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

/** Helper used by the loop — takes absolute origin to avoid relative fetch pitfalls */
async function importOne(origin: string, appId: number): Promise<ImportResult> {
  const url = `${origin}/api/steam/import?appId=${appId}`;
  try {
    const res = await withRetryFetch(url, { cache: "no-store" });
    if (res.ok) {
      return { appId, status: "imported" };
    }
    const { text, json } = await readBody(res);
    const bodyStr =
      (json?.code as string) ||
      (json?.error as string) ||
      (json?.details as string) ||
      text ||
      "";
    if (shouldSkip(res.status, bodyStr)) {
      return { appId, status: "skipped" };
    }
    return { appId, status: "error", message: bodyStr || "Import failed" };
  } catch (e: any) {
    return { appId, status: "error", message: String(e?.message || e) };
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Math.max(1, Number(searchParams.get("days") || 90));
    const concurrency = Math.max(1, Math.min(Number(searchParams.get("concurrency") || 6), 20));

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Find stale games
    const stale = await prisma.game.findMany({
      where: { updatedAt: { lt: cutoff } },
      select: { steamAppId: true },
      orderBy: { updatedAt: "asc" },
      take: 1000, // safety cap
    });

    const ids = stale.map((g) => g.steamAppId).filter((n) => Number.isFinite(n));
    if (ids.length === 0) {
      return NextResponse.json(
        {
          total: 0,
          requested: 0,
          processed: 0,
          importedCount: 0,
          skippedCount: 0,
          errorCount: 0,
          imported: [],
          skipped: [],
          errors: [],
        },
        { status: 200 }
      );
    }

    // Build absolute origin
    const hdrs = await headers();
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
    const fallbackOrigin = new URL(req.url).origin;
    const origin = host ? `${proto}://${host}` : fallbackOrigin;

    const imported: number[] = [];
    const skipped: number[] = [];
    const errors: Array<{ appId: number; status?: number; message: string }> = [];

    // Chunk by concurrency to control pressure
    for (let i = 0; i < ids.length; i += concurrency) {
      const group = ids.slice(i, i + concurrency);
      const results = await Promise.all(group.map((id) => importOne(origin, id)));

      for (const r of results) {
        if (r.status === "imported") imported.push(r.appId);
        else if (r.status === "skipped") skipped.push(r.appId);
        else errors.push({ appId: r.appId, message: r.message });
      }
    }

    return NextResponse.json(
      {
        total: ids.length,
        requested: ids.length,
        processed: ids.length,
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
      { error: "Reimport failed", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
