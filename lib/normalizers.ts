// lib/normalizers.ts

// ---- Types exposed to routes ----
export type ReviewsSummary = {
  label: string | null;    // kept for future use; not persisted to DB by default
  total: number | null;
  positive: number | null;
  percent?: number | null;
};

// Minimal Steam appdetails structure we read from.
export type SteamAppDetails = {
  name?: string;
  short_description?: string;
  header_image?: string;
  capsule_image?: string; // sometimes present
  release_date?: { coming_soon?: boolean; date?: string };
  metacritic?: { score?: number };
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
  genres?: Array<{ id?: string | number; description?: string }>;
  categories?: Array<{ id?: number; description?: string }>;
  screenshots?: Array<{ path_thumbnail?: string; path_full?: string }>;
};

// -------- utilities --------

/** Slugify title into a URL-friendly identifier. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Deduplicate strings case-insensitively while preserving first-seen casing. */
export function uniqueCanonical(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const s = (raw || "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

/** Try to parse Steam's release_date.date (various locale formats) into a Date. */
function parseSteamDate(input?: string): Date | null {
  if (!input) return null;

  const parse = (s: string) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  const d1 = parse(input);
  if (d1) return d1;

  const d2 = parse(input.replace(/,/g, ""));
  if (d2) return d2;

  if (/^\d{4}$/.test(input)) {
    const d3 = parse(`${input}-01-01`);
    if (d3) return d3;
  }

  return null;
}

// -------- extractors --------

/** Extract tag names (Steam "genres" + "categories"). */
export function extractTagNamesFromSteam(d: SteamAppDetails): string[] {
  const genres = d.genres?.map(g => g?.description).filter(Boolean) as string[] || [];
  const categories = d.categories?.map(c => c?.description).filter(Boolean) as string[] || [];
  return uniqueCanonical([...genres, ...categories]);
}

/** Extract platform names; include "PC" if any desktop platform present. */
export function extractPlatformNamesFromSteam(d: SteamAppDetails): string[] {
  const out: string[] = [];
  if (d.platforms?.windows) out.push("Windows");
  if (d.platforms?.mac) out.push("Mac");
  if (d.platforms?.linux) out.push("Linux");
  if (out.length > 0) out.push("PC");
  return uniqueCanonical(out);
}

/** Normalize screenshots into DB-ready rows. */
export function normalizeScreenshots(d: SteamAppDetails): Array<{
  imageUrl: string;
  thumbnailUrl: string | null;
  sortIndex: number;
}> {
  const shots = d.screenshots || [];
  return shots
    .map((s, i) => {
      const full = (s.path_full || "").trim();
      const thumb = (s.path_thumbnail || "").trim();
      if (!full) return null;
      return {
        imageUrl: full,
        thumbnailUrl: thumb || null,
        sortIndex: i,
      };
    })
    .filter(Boolean) as Array<{ imageUrl: string; thumbnailUrl: string | null; sortIndex: number }>;
}

// -------- main mapper --------

/**
 * Map Steam details (and optional reviews) into your Game create/update shape.
 * IMPORTANT: Only includes fields that are safe across schema variants.
 */
export function normalizeGame(
  appId: number,
  d: SteamAppDetails,
  _reviews?: ReviewsSummary | null // kept for future use
): {
  steamAppId: number;
  title: string;
  slug: string;
  summary: string | null;
  headerImageUrl: string | null;
  capsuleImageUrl: string | null;
  releaseDate: Date | null;
  comingSoon: boolean | null;
  metacriticScore: number | null; // keep if your schema has it; Prisma will ignore nulls on update
} {
  const title = (d.name || "").trim() || `App ${appId}`;
  const slug = slugify(title);

  const headerImageUrl = (d.header_image || "").trim() || null;

  const capsuleFromApi =
    (d as any).capsule_image ||
    (d as any).capsuleImage ||
    null;
  const capsuleImageUrl = (capsuleFromApi || "").trim() || null;

  const comingSoon =
    typeof d.release_date?.coming_soon === "boolean" ? d.release_date!.coming_soon! : null;
  const releaseDate = parseSteamDate(d.release_date?.date);

  const metacriticScore =
    typeof d.metacritic?.score === "number" ? d.metacritic!.score! : null;

  return {
    steamAppId: appId,
    title,
    slug,
    summary: (d.short_description || "").trim() || null,
    headerImageUrl,
    capsuleImageUrl,
    releaseDate,
    comingSoon,
    metacriticScore,
  };
}
