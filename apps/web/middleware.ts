import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protects every /dashboard page at the SERVER level:
//
// 1. No session cookie -> immediate redirect to /login.
//    (covers refresh, direct URLs, and back-button navigations
//    that trigger a page load)
//
// 2. Marks dashboard responses "no-store" so browsers never cache
//    them and never restore them from the back/forward cache.
//    That cache is what made the browser BACK button show the
//    logged-in pages after logout.
export function middleware(req: NextRequest) {
  const token =
    req.cookies.get("next-auth.session-token")?.value ||
    req.cookies.get("__Secure-next-auth.session-token")?.value;

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};