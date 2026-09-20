import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("izan_session")?.value;
    if (!token) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

    const session = await prisma.session.findFirst({
      where: { token, expiresAt: { gt: new Date() } },
      include: {
        user: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } }
              }
            },
            company: true
          }
        }
      }
    });

    if (!session || !session.user) {
      return NextResponse.json({ ok: false, error: "Invalid or expired session" }, { status: 401 });
    }

    // Extract a clean array of permission strings (e.g., ["view_banks", "manage_roles"])
    const userPermissions = session.user.role?.permissions.map(rp => rp.permission.action) || [];

    return NextResponse.json({
      ok: true,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role ? { id: session.user.role.id, name: session.user.role.name } : null,
        company: session.user.company ? { id: session.user.company.id, name: session.user.company.name } : null,
        permissions: userPermissions
      }
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Session error" }, { status: 500 });
  }
}