import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-me";

function decodeSessionPayload(cookieValue?: string) {
  if (!cookieValue) return null;

  try {
    const [payloadPart, signaturePart] = cookieValue.split(".");
    if (payloadPart && signaturePart) {
      const payloadJson = Buffer.from(payloadPart, "base64").toString("utf8");
      const expected = Buffer.from(createHmac("sha256", SESSION_SECRET).update(payloadJson).digest("base64url"));
      const actual = Buffer.from(signaturePart);

      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        return null;
      }

      const parsed = JSON.parse(payloadJson);
      return parsed && typeof parsed === "object" ? parsed : null;
    }

    const parsed = JSON.parse(Buffer.from(cookieValue, "base64").toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("ib_session")?.value || request.cookies.get("izan_session")?.value;
    const sessionPayload = decodeSessionPayload(sessionCookie);
    const token = typeof sessionPayload?.token === "string" ? sessionPayload.token : sessionCookie;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });
    }

    const session = await prisma.session.findFirst({
      where: { token, expiresAt: { gt: new Date() } },
      include: {
        user: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } }
              }
            },
            company: true,
          },
        },
      },
    });

    if (!session || !session.user) {
      return NextResponse.json({ ok: false, error: "Invalid or expired session" }, { status: 401 });
    }

    const userPermissions = session.user.role?.rolePermissions?.map((rp) => rp.permission.action).filter(Boolean) || [];

    return NextResponse.json({
      ok: true,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role ? { id: session.user.role.id, name: session.user.role.name } : null,
        company: session.user.company ? { id: session.user.company.id, name: session.user.company.name } : null,
        permissions: userPermissions,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Session error" }, { status: 500 });
  }
}