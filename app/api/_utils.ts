import { z } from "zod";
import { cookies, headers } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const BacklogStatusEnum = z.enum(["BACKLOG","WISHLIST","PLAYING","PAUSED","FINISHED","DROPPED"]);

export const createBacklogSchema = z.object({
  gameId: z.string().cuid(),
  status: BacklogStatusEnum.default("BACKLOG"),
  priority: z.number().int().min(1).max(5).optional(),
  category: z.string().max(64).optional(),
  notes: z.string().max(10_000).optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  lastSessionAt: z.string().datetime().optional(),
});

export async function currentUserId() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const supabase = createServerClient(URL, KEY, {
    cookies: {
      get: (name: string) => cookieStore.get(name)?.value,
      set: (name: string, value: string, options: CookieOptions) =>
        cookieStore.set({ name, value, ...options }),
      remove: (name: string, options: CookieOptions) =>
        cookieStore.set({ name, value: "", ...options }),
    },
    // Allow Authorization: Bearer <token> when cookies aren't present
    global: { headers: { Authorization: headerStore.get("authorization") ?? "" } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  // Normalize errors to a simple 401 so UX is consistent
  if (error?.message?.includes("Auth session missing")) {
    throw new Error("Not authenticated");
  }
  if (error) {
    throw new Error("Not authenticated");
  }
  if (!user) {
    throw new Error("Not authenticated");
  }

  return user.id;
}
