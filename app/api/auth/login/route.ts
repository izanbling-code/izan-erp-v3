import { NextRequest, NextResponse } from "next/server";
import crypto, { createHmac, scryptSync, timingSafeEqual } from "crypto";
import { prisma } from "@/app/lib/prisma";
import { authRateLimit } from "@/app/lib/rate-limit";

const SESSION_DAYS = 7;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-me";

function verifyPassword(password: string, storedPassword: string) {
  const parts = storedPassword.split(":");
  if (parts.length !== 2) return false;
  const [salt, storedHash] = parts;
  try {
    const derivedHash = scryptSync(password, salt, 64).toString("hex");
    return timingSafeEqual(
      Buffer.from(derivedHash, "hex"),
      Buffer.from(storedHash, "hex")
    );
  } catch {
    return false;
  }
}

function encodeSessionPayload(payload: Record<string, unknown>) {
  const payloadJson = JSON.stringify(payload);
  const encodedPayload = Buffer.from(payloadJson).toString("base64");
  const signature = createHmac("sha256", SESSION_SECRET).update(payloadJson).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const rateLimitKey = `login_attempt:${ip}`;

    const { success, limit, reset, remaining } = await authRateLimit.limit(rateLimitKey);

    if (!success) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again in a minute." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
            "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true, company: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Your user account is inactive." }, { status: 403 });
    }

    if (!verifyPassword(password, user.password)) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        id: crypto.randomUUID(),
        updatedAt: new Date(),
        userId: user.id,
        token,
        expiresAt,
      },
    });

    const isAdmin = user.email === "admin@izan.com" || (user.role?.name || "").toLowerCase().includes("admin");
    const finalPermissions = isAdmin ? ["/"] : user.role?.permissions || [];

    const sessionPayload = {
      token,
      userId: user.id,
      role: user.role?.name || "User",
      permissions: finalPermissions,
      exp: expiresAt.toISOString(),
    };

    const encodedSession = encodeSessionPayload(sessionPayload);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        role: user.role ? { id: user.role.id, name: user.role.name } : null,
        company: user.company ? { id: user.company.id, name: user.company.name } : { id: "none", name: "Default Company" },
      },
    });

    response.cookies.set("ib_session", encodedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json({ error: "Unable to log in. Please try again." }, { status: 500 });
  }
}