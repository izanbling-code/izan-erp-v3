import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const invoices = await prisma.salesInvoice.findMany({
      where: {
        companyId: company.id,
        status: { in: ["POSTED", "PARTIAL", "PAID"] },
        ...(from || to ? {
          invoiceDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {})
          }
        } : {})
      },
      include: {
        customer: true,
        lines: true
      },
      orderBy: { invoiceDate: "asc" }
    });

    const rows = invoices.map((invoice) => {
      const cogs = invoice.lines.reduce((sum, line) => sum + Number(line.cogsTotal ?? 0), 0);
      const total = Number(invoice.total ?? 0);
      return {
        customerId: invoice.customerId,
        customer: invoice.customer?.name ?? "Unknown",
        invoiceNo: invoice.invoiceNo,
        invoiceDate: invoice.invoiceDate,
        total,
        cogs,
        grossProfit: total - cogs
      };
    });

    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to load sales report" }, { status: 500 });
  }
}
