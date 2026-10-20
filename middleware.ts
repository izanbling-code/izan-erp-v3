import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-me";

type SessionPayload = {
  token: string;
  permissions?: unknown;
  exp: string;
};

function decodeBase64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function decodeSessionCookie(rawValue: string | undefined): Promise<SessionPayload | null> {
  if (!rawValue) return null;

  try {
    const [payloadPart, signaturePart, extraPart] = rawValue.split(".");
    if (!payloadPart || !signaturePart || extraPart) return null;

    const payloadJson = new TextDecoder().decode(decodeBase64(payloadPart));
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const expectedSignature = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadJson))
    );
    const actualSignature = decodeBase64(signaturePart);

    if (expectedSignature.length !== actualSignature.length) return null;
    let difference = 0;
    for (let index = 0; index < expectedSignature.length; index++) {
      difference |= expectedSignature[index] ^ actualSignature[index];
    }
    if (difference !== 0) return null;

    const parsed: unknown = JSON.parse(payloadJson);
    if (!parsed || typeof parsed !== "object") return null;

    const session = parsed as Partial<SessionPayload>;
    if (
      typeof session.token !== "string" ||
      typeof session.exp !== "string" ||
      !Number.isFinite(Date.parse(session.exp)) ||
      Date.parse(session.exp) <= Date.now()
    ) {
      return null;
    }

    return session as SessionPayload;
  } catch {
    return null;
  }
}

function isPathAllowed(pathname: string, allowedPaths: string[]) {
  return allowedPaths.some((allowedPath) => {
    if (typeof allowedPath !== "string" || !allowedPath) return false;

    const normalizedAllowed = allowedPath.endsWith("/") ? allowedPath.slice(0, -1) : allowedPath;
    return pathname === normalizedAllowed || pathname.startsWith(`${normalizedAllowed}/`);
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("ib_session")?.value;

  if (pathname === "/shop" || pathname.startsWith("/shop/")) {
    if (pathname === "/shop/admin" || pathname.startsWith("/shop/admin/")) {
      const session = await decodeSessionCookie(sessionCookie);
      if (!session) {
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.delete("ib_session");
        return response;
      }
    } else {
      return NextResponse.next();
    }
  }

  if (
    (pathname === "/api/shop" || pathname.startsWith("/api/shop/")) &&
    pathname !== "/api/shop/admin" &&
    !pathname.startsWith("/api/shop/admin/")
  ) {
    return NextResponse.next();
  }

  const isApiRoute = pathname.startsWith("/api/");

  if (pathname === "/login") {
    const session = await decodeSessionCookie(sessionCookie);
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    const response = NextResponse.next();
    if (sessionCookie) response.cookies.delete("ib_session");
    return response;
  }

  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "auth/confirm" ||
    pathname === "/unauthorized" ||
    pathname === "/" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth");

  if (isPublicRoute) {
    return NextResponse.next();
  }

  if (!sessionCookie) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await decodeSessionCookie(sessionCookie);
  if (!session || !Array.isArray(session.permissions)) {
    const response = isApiRoute
      ? NextResponse.json({ error: "Invalid session" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("ib_session");
    return response;
  }

  const allowedPaths = session.permissions.filter(
    (permission): permission is string => typeof permission === "string" && permission.length > 0
  );
  const isAuthorized = allowedPaths.includes("/") || isPathAllowed(pathname, allowedPaths);

  if (!isAuthorized) {
    if (isApiRoute) {
      return NextResponse.json({ error: "API Access Denied" }, { status: 403 });
    }
    return NextResponse.redirect(new URL(`/unauthorized?target=${encodeURIComponent(pathname)}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  // This tells Next.js to skip middleware for API routes and static files
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};