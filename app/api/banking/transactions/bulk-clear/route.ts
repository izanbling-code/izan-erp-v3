import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function PUT(req: NextRequest) {
  try {
    const { ids } = await req.json();
    if (!ids || !Array.isArray(ids)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    await prisma.bankTransaction.updateMany({
      where: { id: { in: ids } },
      data: { status: "CLEARED" }
    });

    return NextResponse.json({ ok: true, message: "Transactions locked and cleared" });
  } catch(e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}