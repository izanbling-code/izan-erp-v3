import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static files, Next.js internals, the login page, AND the Auth API
  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname === "/login" ||
    pathname === "/" ||
    pathname.startsWith("/api/auth") // <--- FIX: Allow login requests to process!
  ) {
    return NextResponse.next();
  }

  const isAuthenticated = 
    req.cookies.has("session") || 
    req.cookies.has("token") || 
    req.cookies.has("next-auth.session-token");

  // Handle public storefront routes
  if (pathname.startsWith("/shop") || pathname.startsWith("/api/shop")) {
    if (pathname.startsWith("/shop/admin") && !isAuthenticated) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // Block access to all other ERP routes if not authenticated
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
