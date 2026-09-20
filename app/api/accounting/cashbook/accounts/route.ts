import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    // Fetch all active accounts that act as Cash or Bank ledgers
    const accounts = await prisma.account.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        OR: [
          { systemCode: "CASH" },
          { systemCode: "BANK" },
          // Fetch the exact asset codes we generate for banks (1050, 1051, etc.)
          { type: "ASSET", code: { startsWith: "10" } } 
        ]
      },
      select: {
        id: true, code: true, name: true, systemCode: true
      },
      orderBy: { code: "asc" }
    });

    return NextResponse.json({ ok: true, accounts });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to load cash/bank accounts" }, { status: 500 });
  }
}