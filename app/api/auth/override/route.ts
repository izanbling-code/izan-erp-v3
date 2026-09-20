import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// 👑 YOUR DEDICATED OVERRIDE PASSWORD
const OVERRIDE_PASSWORD = "Idontknow@2";

export async function POST(request: NextRequest) {
  try {
    const { password, targetPath } = await request.json();

    if (!password || !targetPath) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Verify against the secure Master Password instead of the dummy DB hash
    if (password !== OVERRIDE_PASSWORD) {
      return NextResponse.json({ error: "Invalid Admin override password" }, { status: 401 });
    }

    // 2. Read the user's current restricted session
    const sessionCookie = request.cookies.get("ib_session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "No active session" }, { status: 401 });

    const session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf-8'));

    // 3. Inject the blocked path into their permissions array for this session
    if (!session.permissions.includes(targetPath)) {
      session.permissions.push(targetPath);
    }

    const encodedSession = Buffer.from(JSON.stringify(session)).toString('base64');
    const response = NextResponse.json({ success: true });

    // 4. Update their cookie with the new permission
    response.cookies.set("ib_session", encodedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Override error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}