import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const pendingUsers = await prisma.user.findMany({
      where: { 
        isActive: false // Only fetch users waiting for approval
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ ok: true, users: pendingUsers });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to load pending users" }, { status: 500 });
  }
}