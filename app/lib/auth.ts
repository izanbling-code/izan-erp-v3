// @ts-nocheck
import { NextRequest } from "next/server";
import { prisma } from "./prisma";

export async function authenticate(request: NextRequest, requiredPermission?: string) {
  const token = request.cookies.get("izan_session")?.value;
  if (!token) return null;
  
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