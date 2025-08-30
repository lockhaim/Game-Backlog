import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // DEBUG: prove middleware runs
  // console.log("MW hit:", req.nextUrl.pathname);

  const supabase = createMiddlewareClient({ req, res });

  // Touch the session so Supabase writes/refreshes cookies
  await supabase.auth.getSession();

  return res;
}

export const config = {
  // run on everything except static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
