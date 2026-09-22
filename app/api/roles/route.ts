import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst(); 
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const roles = await prisma.role.findMany({
      where: { companyId: company.id },
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ success: true, roles });
  } catch (error) {
    console.error("GET /api/roles error:", error);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, permissions } = body;

    if (!name || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json({ error: "Invalid role data" }, { status: 400 });
    }

    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    // SMART FIX: Automatically grant the universal skeleton key to any Admin role
    const finalPermissions = name.toLowerCase().includes("admin") ? ["/"] : permissions;

    const newRole = await prisma.role.create({
      data: {
        name,
        permissions: finalPermissions,
        companyId: company.id
      }
    });

    return NextResponse.json({ success: true, role: newRole });
  } catch (error) {
    console.error("POST /api/roles error:", error);
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}
