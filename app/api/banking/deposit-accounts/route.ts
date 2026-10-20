import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const company = await prisma.company.findFirst();
    const accounts = await prisma.account.findMany({
      where: { companyId: company?.id, isActive: true },
      select: { id: true, code: true, name: true, type: true },
      orderBy: { code: 'asc' }
    });
    return NextResponse.json({ ok: true, accounts });
  } catch(e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}