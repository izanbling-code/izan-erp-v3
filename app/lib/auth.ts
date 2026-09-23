import { NextRequest } from "next/server";
import { prisma } from "./prisma";

export async function authenticate(request: NextRequest, requiredPermission?: string) {
  const cookieVal = request.cookies.get("ib_session")?.value || request.cookies.get("izan_session")?.value;
  if (!cookieVal) return null;
  
  let token = cookieVal;
  
  try {
    const decoded = Buffer.from(cookieVal, "base64").toString("utf8");
    if (decoded.includes('"token"')) {
      const sessionPayload = JSON.parse(decoded);
      token = sessionPayload.token;
    }
  } catch (e) {
    // If it fails to parse, assume it is already a raw string token
  }
  
  const session = await prisma.session.findFirst({
    where: { token, expiresAt: { gt: new Date() } },
    include: { user: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
  });
  
  if (!session || !session.user) return null;
  const user = session.user;
  
  // 👑 ULTIMATE FAILSAFE: The Admin owner ALWAYS gets in, regardless of DB state.
  if (user.email === "admin@izan.com") return user;
  
  const roleName = user.role?.name?.toUpperCase() || "";
  if (roleName === "ADMIN" || roleName === "ADMINISTRATOR") return user;
  
  if (requiredPermission) {
    const permissions = user.role?.permissions.map((rp: any) => rp.permission.action) || [];
    if (!permissions.includes(requiredPermission)) return null;
  }
  return user; 
}
