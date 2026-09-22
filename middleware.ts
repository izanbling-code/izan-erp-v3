import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. PUBLIC SHOP ROUTES (Exempt from auth, except Admin)
  if (pathname.startsWith("/shop") || pathname.startsWith("/api/shop")) {
    if (pathname.startsWith("/shop/admin")) {
      const sessionCookie = request.cookies.get("ib_session")?.value;
      if (!sessionCookie) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      // If they have a cookie, let it fall through to the permission checker below
    } else {
      // Normal public shop page or API (e.g., /shop, /shop/product/1, /api/shop/checkout)
      return NextResponse.next();
    }
  }

  const isApiRoute = pathname.startsWith("/api/");
  const sessionCookie = request.cookies.get("ib_session")?.value;

  // 2. Prevent logged-in users from seeing the login screen
  if (pathname === "/login" && sessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 3. Let public routes pass through
  const isPublicRoute = 
    pathname === "/login" || 
    pathname === "/unauthorized" || 
    pathname === "/" ||
    pathname.startsWith("/_next") || 
    pathname.startsWith("/api/auth");
  
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // 4. Block unauthenticated access
  if (!sessionCookie) {
    if (isApiRoute) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 5. Custom RBAC Permission Engine
  try {
    const session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf-8'));
    const allowedPaths: string[] = session.permissions || [];

    // SMART API ROUTING: If this is an API call, verify access based on the UI page that requested it
    let pathToCheck = pathname;
    if (isApiRoute) {
      const referer = request.headers.get("referer");
      if (referer) {
        try {
          pathToCheck = new URL(referer).pathname;
        } catch (e) {}
      }
    }

    // Verify access
    const isAuthorized = allowedPaths.includes("/") || allowedPaths.some(allowedPath => pathToCheck.startsWith(allowedPath));

    if (!isAuthorized) {
      if (isApiRoute) return NextResponse.json({ error: "API Access Denied" }, { status: 403 });
      return NextResponse.redirect(new URL("/unauthorized?target=" + pathname, request.url));
    }

    return NextResponse.next();
  } catch (error) {
    if (isApiRoute) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("ib_session");
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)"
  ],
};
