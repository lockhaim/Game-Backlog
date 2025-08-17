// app/api/steam/keytest/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qpKey = searchParams.get("key") || undefined;
  const qpId = searchParams.get("steamId") || undefined;

  const key = (process.env.STEAM_WEB_API_KEY ?? "").trim();
  const id = (process.env.STEAM_USER_ID ?? "").trim();

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    hasKey: Boolean(key),
    keyPrefix: key ? key.slice(0, 6) + "…" : null,
    keyLength: key.length,
    hasId: Boolean(id),
    idLength: id.length,
    // Optional: compare to query params to ensure exact match
    matchesQueryKey: qpKey ? key === qpKey.trim() : null,
    matchesQueryId: qpId ? id === qpId.trim() : null,
  });
}

export const dynamic = "force-dynamic";
export const revalidate = 0; // Always fresh, no caching