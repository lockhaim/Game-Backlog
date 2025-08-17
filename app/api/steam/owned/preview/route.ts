import { NextResponse } from "next/server";
import { fetchOwnedGames, normalizeOwnedGame } from "@/lib/steamOwned";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = (searchParams.get("key") || process.env.STEAM_WEB_API_KEY || "").trim();
    const steamId = (searchParams.get("steamId") || process.env.STEAM_USER_ID || "").trim();

    if (!key) return NextResponse.json({ error: "Missing STEAM_WEB_API_KEY" }, { status: 500 });
    if (!steamId) return NextResponse.json({ error: "Missing steamId" }, { status: 400 });

    const raw = await fetchOwnedGames(steamId, key);
    const normalized = raw.map(normalizeOwnedGame)
      .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)
      .slice(0, 10);

    return NextResponse.json({ games: normalized });
  } catch (err: any) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0; // Always fresh, no caching