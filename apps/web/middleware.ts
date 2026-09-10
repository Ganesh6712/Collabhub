import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protects the app at the SERVER level:
//
// 1. /dashboard/* is for signed-in users only — no session cookie
//    means an immediate redirect to /login (covers refresh, direct
//    URLs, and back/forward navigations that trigger a page load).
//
// 2. Dashboard AND login responses are marked "no-store" so the
//    browser never caches them and never restores them from the
//    back/forward cache. That cache is what made the BACK button
//    show the logged-in pages after logout, and the FORWARD button
//    re-enter the app after landing back on the login page.
export function middleware(req: NextRequest) {
  const token =
    req.cookies.get("next-auth.session-token")?.value ||
    req.cookies.get("__Secure-next-auth.session-token")?.value;

  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard") && !token) {
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
  matcher: ["/dashboard/:path*", "/login"],
};