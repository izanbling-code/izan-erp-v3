import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const stockBatches = await prisma.stockBatch.findMany({
      where: {
        product: { companyId: company.id },
        quantity: { gt: 0 }
      },
      include: {
        product: true,
        warehouse: true,
        batch: true
      },
      orderBy: { product: { name: "asc" } }
    });

    const rows = stockBatches.map(sb => {
      const qty = Number(sb.quantity ?? 0);
      const unitCost = Number(sb.batch?.unitCost ?? 0);
      return {
        product: sb.product.name,
        sku: sb.product.sku,
        warehouse: sb.warehouse.name,
        batchNo: sb.batch.batchNumber,
        quantity: qty,
        unitCost: unitCost,
        totalValuation: qty * unitCost
      };
    });

    const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
    const totalValuation = rows.reduce((s, r) => s + r.totalValuation, 0);

    return NextResponse.json({
      ok: true,
      rows,
      summary: {
        "Total Units In Stock": totalQty,
        "Total Inventory Value": `Rs ${totalValuation.toFixed(2)}`
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to load inventory valuation" }, { status: 500 });
  }
}
