import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Always allow static files, Next.js internals, and the login page itself
  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname === "/login" ||
    pathname === "/" // Assuming root might be your login or landing page
  ) {
    return NextResponse.next();
  }

  // 2. Determine if the user has an active session cookie
  // (Checks common token names depending on how your auth was previously configured)
  const isAuthenticated = 
    req.cookies.has("session") || 
    req.cookies.has("token") || 
    req.cookies.has("next-auth.session-token");

  // 3. Handle public storefront routes
  if (pathname.startsWith("/shop") || pathname.startsWith("/api/shop")) {
    // STRICT EXCEPTION: Lock down the Shop Admin panel!
    if (pathname.startsWith("/shop/admin") && !isAuthenticated) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    // Allow normal public shop traffic
    return NextResponse.next();
  }

  // 4. Block access to all other ERP routes if not authenticated
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all paths except static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
