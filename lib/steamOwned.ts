// lib/steamOwned.ts

// Steam Web API: IPlayerService/GetOwnedGames
// Docs: https://partner.steamgames.com/doc/webapi/IPlayerService#GetOwnedGames
const OWNED_BASE =
  "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/";

export type OwnedGamesResponse = {
  response?: {
    game_count?: number;
    games?: Array<{
      appid: number;
      name?: string;
      playtime_forever?: number;      // total minutes
      img_icon_url?: string;          // hash only
      img_logo_url?: string;          // hash only (often missing)
      rtime_last_played?: number;     // epoch seconds
    }>;
  };
};

export type OwnedGame = NonNullable<
  NonNullable<OwnedGamesResponse["response"]>["games"]
>[number];

/**
 * Fetch the user's owned games list from Steam.
 * Requires: a valid Steam Web API key and a public SteamID64.
 */
export async function fetchOwnedGames(steamId: string, key: string) {
  const k = (key || "").trim();           // ← trim whitespace/newlines
  if (!k) throw new Error("Missing Steam Web API key");

  const url = new URL(OWNED_BASE);
  url.searchParams.set("key", k);         // ← use trimmed key
  url.searchParams.set("steamid", steamId.trim());
  url.searchParams.set("include_appinfo", "true");
  url.searchParams.set("include_played_free_games", "1");
  url.searchParams.set("format", "json");
  
  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      // A friendly UA helps some gateways; customize the contact if you like.
      "user-agent": "GameBacklogApp/1.0 (contact: you@example.com)",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Steam owned games ${res.status}: ${
        text || "Unauthorized/Invalid key or SteamID?"
      }`
    );
  }

  const json = (await res.json()) as OwnedGamesResponse;
  // If profile is private or empty, you'll often get undefined/empty here.
  return json.response?.games ?? [];
}

/** Build the full icon URL from the hash Steam returns. */
export function ownedIconUrl(appid: number, hash?: string | null) {
  if (!hash) return null;
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${hash}.jpg`;
}

/** Build the full logo URL (may be missing for many apps). */
export function ownedLogoUrl(appid: number, hash?: string | null) {
  if (!hash) return null;
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${hash}.jpg`;
}

/**
 * Normalize a single owned-game entry into a shape that’s easy to render.
 * (You can use this for previews/lists without hitting appdetails yet.)
 */
export function normalizeOwnedGame(game: OwnedGame) {
  return {
    id: game.appid,
    title: game.name ?? `app-${game.appid}`,
    playtimeMinutes: game.playtime_forever ?? 0,
    iconUrl: ownedIconUrl(game.appid, game.img_icon_url ?? null),
    logoUrl: ownedLogoUrl(game.appid, game.img_logo_url ?? null),
    lastPlayed:
      typeof game.rtime_last_played === "number"
        ? new Date(game.rtime_last_played * 1000)
        : null,
  };
}
