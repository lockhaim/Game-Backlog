// app/api/steam/import/route.ts
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  normalizeGame,
  normalizeScreenshots,
  extractTagNamesFromSteam,
  extractPlatformNamesFromSteam,
  uniqueCanonical,
  type SteamAppDetails,
  type ReviewsSummary,
} from "@/lib/normalizers";
import { fetchAppDetails } from "@/lib/steam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyObj = Record<string, any>;

/** Heuristic: does this object look like a Steam appdetails payload? */
function hasDetailsShape(x: any): boolean {
  return (
    x &&
    typeof x === "object" &&
    (typeof x.name === "string" ||
      typeof x.short_description === "string" ||
      (x.release_date && typeof x.release_date === "object"))
  );
}

/** Accepts any of these shapes and returns a uniform { success, data, shape }:
 *  A) { [appid: string]: { success: boolean; data?: SteamAppDetails|null } }
 *  B) { success: boolean; data?: SteamAppDetails|null }
 *  C) Direct SteamAppDetails object (no success key)
 *  D) { [appid: string]: SteamAppDetails }
 */
function unwrapDetailsResponse(
  payload: unknown,
  appId: number
): { success: boolean; data: SteamAppDetails | null; shape: "A" | "B" | "C" | "D" | "unknown" } | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as AnyObj;

  // Shape B: flat { success, data }
  if (typeof obj.success === "boolean") {
    const data = (obj.data ?? (hasDetailsShape(obj) ? obj : null)) as SteamAppDetails | null;
    return { success: !!obj.success, data, shape: "B" };
  }

  const key = String(appId);
  const entry = (obj as AnyObj)[key];

  // Shape A: envelope keyed by appId with { success, data }
  if (entry && typeof entry === "object" && typeof entry.success === "boolean") {
    const data = (entry.data ?? (hasDetailsShape(entry) ? entry : null)) as SteamAppDetails | null;
    return { success: !!entry.success, data, shape: "A" };
  }

  // Shape D: envelope keyed by appId directly to details
  if (entry && hasDetailsShape(entry)) {
    return { success: true, data: entry as SteamAppDetails, shape: "D" };
  }

  // Shape C: direct details object
  if (hasDetailsShape(obj)) {
    return { success: true, data: obj as SteamAppDetails, shape: "C" };
  }

  return { success: false, data: null, shape: "unknown" };
}

/** Optional reviews fetch; works even if your module doesn’t export fetchReviewSummary */
async function tryFetchReviewSummary(appId: number): Promise<ReviewsSummary | null> {
  try {
    const mod = await import("@/lib/steam");
    const fn: unknown = (mod as AnyObj).fetchReviewSummary;
    if (typeof fn === "function") {
      const res = await (fn as (a: number) => Promise<ReviewsSummary>)(appId);
      return res ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Core logic used by both GET and POST */
async function importOne(appId: number, debug = false): Promise<NextResponse> {
  try {
    // 1) Fetch Steam details
    const rawDetails = await fetchAppDetails(appId);
    const unwrapped = unwrapDetailsResponse(rawDetails, appId);

    if (!unwrapped || !unwrapped.success || !unwrapped.data) {
      // Small debug blob helps when Steam returns 403/empty
      const debugBlob =
        rawDetails && typeof rawDetails === "object"
          ? {
              shape: unwrapped?.shape ?? "unknown",
              topKeys: Object.keys(rawDetails as AnyObj).slice(0, 4),
              typeofPayload: typeof rawDetails,
              // Try to surface the inner entry (if present)
              rawSample: (rawDetails as AnyObj)[String(appId)] ?? null,
            }
          : { shape: "unknown", topKeys: [], typeofPayload: typeof rawDetails };

      return NextResponse.json(
        {
          error: "Import skipped",
          code: "NO_APPDETAILS",
          details: `Steam appdetails returned no data for appId=${appId}`,
          debug: debugBlob,
        },
        { status: 422 }
      );
    }

    const d = unwrapped.data as SteamAppDetails;

    // 2) Optionally fetch reviews (non-fatal if not available)
    const reviews = await tryFetchReviewSummary(appId);

    // 3) Map to DB fields & related vocab
    const gameData = normalizeGame(appId, d, reviews);
    const { slug, ...updateData } = gameData; // don't change slug on update

    const tagNames = uniqueCanonical(extractTagNamesFromSteam(d));
    const platformNames = uniqueCanonical(extractPlatformNamesFromSteam(d));
    const screenshots = normalizeScreenshots(d);

    // 4) Seed vocab tables OUTSIDE the transaction
    if (tagNames.length) {
      await prisma.tag.createMany({
        data: tagNames.map((name) => ({ name })),
        skipDuplicates: true,
      });
    }
    if (platformNames.length) {
      await prisma.platform.createMany({
        data: platformNames.map((name) => ({ name })),
        skipDuplicates: true,
      });
    }

    // 5) Fetch IDs once
    const [tags, platforms] = await Promise.all([
      tagNames.length
        ? prisma.tag.findMany({ where: { name: { in: tagNames } } })
        : Promise.resolve([]),
      platformNames.length
        ? prisma.platform.findMany({ where: { name: { in: platformNames } } })
        : Promise.resolve([]),
    ]);

    // 6) Tiny atomic block: upsert Game, link joins, refresh screenshots
    await prisma.$transaction(
      async (tx) => {
        const game = await tx.game.upsert({
          where: { steamAppId: appId },
          update: { ...updateData }, // no slug on update
          create: { ...gameData }, // slug set on create
        });

        if (tags.length) {
          await tx.gameTag.createMany({
            data: tags.map((t) => ({ gameId: game.id, tagId: t.id })),
            skipDuplicates: true,
          });
        }

        if (platforms.length) {
          await tx.gamePlatform.createMany({
            data: platforms.map((p) => ({ gameId: game.id, platformId: p.id })),
            skipDuplicates: true,
          });
        }

        // Refresh screenshots (replace set)
        await tx.screenshot.deleteMany({ where: { gameId: game.id } });
        if (screenshots.length) {
          await tx.screenshot.createMany({
            data: screenshots.map((s) => ({ ...s, gameId: game.id })),
          });
        }
      },
      { timeout: 30_000, maxWait: 5_000 }
    );

    // Success
    if (debug) {
      return NextResponse.json(
        {
          ok: true,
          debug: {
            title: gameData.title,
            steamAppId: appId,
            headerImageUrl: gameData.headerImageUrl,
            screenshotsCount: screenshots.length,
            screenshotsSample: screenshots.slice(0, 4).map((s) => s.imageUrl),
            tagNames,
            platformNames,
            reviews: reviews?.query_summary
              ? {
                  label: reviews.query_summary.review_score_desc,
                  total: reviews.query_summary.total_reviews,
                  positive: reviews.query_summary.total_positive,
                }
              : null,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    // Map duplicates to 409
    if (
      err?.code === "P2002" ||
      (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
    ) {
      return NextResponse.json(
        { error: "Duplicate", code: "P2002", meta: err?.meta },
        { status: 409 }
      );
    }

    console.error("Import failed", { err });

    return NextResponse.json(
      {
        error: "Import failed",
        details: err?.message ?? String(err),
        code: err?.code ?? undefined,
        meta: err?.meta ?? undefined,
      },
      { status: 500 }
    );
  }
}

/** GET /api/steam/import?appId=220[&debug=1] */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const appId = Number(searchParams.get("appId"));
  const debug =
    searchParams.get("debug") === "1" ||
    searchParams.get("debug") === "true";
  if (!Number.isFinite(appId) || appId <= 0) {
    return NextResponse.json({ error: "Missing or invalid appId" }, { status: 400 });
  }
  return importOne(appId, debug);
}

/** POST /api/steam/import  body: { appId: 220, debug?: boolean } */
export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const appId = Number(body?.appId ?? body?.appid);
  const debug = !!body?.debug;
  if (!Number.isFinite(appId) || appId <= 0) {
    return NextResponse.json({ error: "Missing or invalid appId" }, { status: 400 });
  }
  return importOne(appId, debug);
}
