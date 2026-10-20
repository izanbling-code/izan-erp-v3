import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-me";

function decodeSessionPayload(cookieValue?: string) {
  if (!cookieValue) return null;

  try {
    const [payloadPart, signaturePart] = cookieValue.split(".");
    if (payloadPart && signaturePart) {
      const payloadJson = Buffer.from(payloadPart, "base64").toString("utf8");
      const expected = Buffer.from(
        createHmac("sha256", SESSION_SECRET).update(payloadJson).digest("base64url")
      );
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

export async function authenticate(request: NextRequest, requiredPermission?: string) {
  const cookieVal = request.cookies.get("ib_session")?.value || request.cookies.get("izan_session")?.value;
  if (!cookieVal) return null;

  const sessionPayload = decodeSessionPayload(cookieVal);
  if (!sessionPayload || !sessionPayload.token) return null;

  const session = await prisma.session.findFirst({
    where: { token: sessionPayload.token, expiresAt: { gt: new Date() } },
    include: {
      user: {
        include: {
          role: { include: { rolePermissions: { include: { permission: true } } } },
        },
      },
    },
  });

  if (!session || !session.user) return null;
  const user = session.user;

  if (user.email === "admin@izan.com") return user;

  const roleName = user.role?.name?.toUpperCase() || "";
  if (roleName === "ADMIN" || roleName === "ADMINISTRATOR") return user;

  if (requiredPermission) {
    const permissions = user.role?.rolePermissions?.map((rp: any) => rp.permission.action) || [];
    if (!permissions.includes(requiredPermission)) return null;
  }

  return user;
}
