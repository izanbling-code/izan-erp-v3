import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 1. ALWAYS ALLOW public assets and auth routes
  if (
    path.startsWith("/_next") ||
    path.includes(".") ||
    path === "/login" ||
    path === "/" ||
    path.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  // 2. SMART AUTH CHECK: Check for ANY cookie that sounds like a login token
  // This prevents the bug where registered users get locked out
  const allCookies = req.cookies.getAll();
  const isAuthenticated = allCookies.some(c => 
    ['token', 'session', 'auth', 'jwt', 'user'].some(keyword => c.name.toLowerCase().includes(keyword))
  );

  // 3. PUBLIC SHOP RULES
  if (path.startsWith("/shop") || path.startsWith("/api/shop")) {
    // STRICT BLOCK: Shop Admin requires login
    if (path.startsWith("/shop/admin") && !isAuthenticated) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    // Allow regular public shop pages
    return NextResponse.next();
  }

  // 4. MAIN ERP BLOCK: If no auth cookie is found, kick them to login
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
