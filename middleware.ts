import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // EXPLICITLY ALLOW ALL PUBLIC SHOP ROUTES & APIS WITHOUT LOGIN
  if (path.startsWith("/shop") || path.startsWith("/api/shop")) {
    return NextResponse.next();
  }

  // Keep the rest of your ERP authentication rules intact below...
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|shop|api/shop).*)"
  ],
};
