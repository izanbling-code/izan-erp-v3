import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const bills = await prisma.purchaseBill.findMany({
      where: {
        companyId: company.id,
        ...(from || to ? {
          billDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {})
          }
        } : {})
      },
      include: { supplier: true, lines: true },
      orderBy: { billDate: "asc" }
    });

    const rows = bills.map((bill) => ({
      supplierId: bill.supplierId,
      supplier: bill.supplier?.name ?? "Unknown",
      billNo: bill.billNo,
      billDate: bill.billDate,
      subtotal: Number(bill.subtotal ?? 0),
      tax: Number(bill.tax ?? 0),
      total: Number(bill.total ?? 0),
      paid: Number(bill.paid ?? 0),
      balance: Number(bill.balance ?? 0)
    }));

    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to load purchase report" }, { status: 500 });
  }
}
