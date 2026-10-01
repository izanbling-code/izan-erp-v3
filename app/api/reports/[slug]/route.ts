import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> | { slug: string } }) {
  try {
    // Await params to safely support Next.js 14 and 15+
    const params = await props.params;
    const slug = params.slug;

    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured." }, { status: 400 });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let title = "";
    let columns: string[] = [];
    let rows: string[][] = [];

    if (slug === "sales") {
      title = "Monthly Posted Sales Report";
      columns = ["Invoice #", "Date", "Customer", "Total", "Balance"];
      const data = await prisma.salesInvoice.findMany({
        where: { companyId: company.id, invoiceDate: { gte: startOfMonth }, status: "POSTED" },
        include: { customer: true },
        orderBy: { invoiceDate: "desc" }
      });
      rows = data.map((d: any) => [d.invoiceNo, new Date(d.invoiceDate).toLocaleDateString(), d.customer?.name || "Walk-in Cash", d.total.toString(), d.balance.toString()]);
    } 
    else if (slug === "orders") {
      title = "Today's Activity & Pending Drafts";
      columns = ["Invoice #", "Date", "Status", "Customer", "Total"];
      const data = await prisma.salesInvoice.findMany({
        where: { companyId: company.id, OR: [{ invoiceDate: { gte: startOfToday } }, { status: "DRAFT" }] },
        include: { customer: true },
        orderBy: { invoiceDate: "desc" }
      });
      rows = data.map((d: any) => [d.invoiceNo, new Date(d.invoiceDate).toLocaleDateString(), d.status, d.customer?.name || "Walk-in Cash", d.total.toString()]);
    } 
    else if (slug === "receivables") {
      title = "Outstanding Customer Credit";
      columns = ["Invoice #", "Date", "Customer", "Total", "Balance Due"];
      const data = await prisma.salesInvoice.findMany({
        where: { companyId: company.id, balance: { gt: 0 }, status: "POSTED" },
        include: { customer: true },
        orderBy: { invoiceDate: "asc" }
      });
      rows = data.map((d: any) => [d.invoiceNo, new Date(d.invoiceDate).toLocaleDateString(), d.customer?.name || "Walk-in Cash", d.total.toString(), d.balance.toString()]);
    } 
    else if (slug === "inventory") {
      title = "Warehouse Stock Valuation";
      columns = ["Product", "Available Qty", "Base Unit Cost", "Total Asset Value"];
      const data = await prisma.stock.findMany({
        where: { companyId: company.id, quantity: { gt: 0 } },
        include: { product: true }
      });
      rows = data.map((d: any) => [d.product.name, String(d.quantity), String(d.product.costPrice || 0), (Number(d.quantity) * Number(d.product.costPrice || 0)).toString()]);
    } 
    else if (slug === "purchases") {
      title = "Open Purchase Orders";
      columns = ["PO #", "Date", "Supplier", "Total", "Status"];
      try {
        const data = await (prisma as any).purchaseBill.findMany({
          where: { companyId: company.id, status: "DRAFT" },
          include: { supplier: true }
        });
        rows = data.map((d: any) => [d.billNo, new Date(d.billDate).toLocaleDateString(), d.supplier?.name || "Unknown", d.total.toString(), d.status]);
      } catch (e) {
        rows = [["-", "-", "No Open Orders Found", "0.00", "-"]];
      }
    } 
    else {
      return NextResponse.json({ ok: false, error: "Report module not found: " + slug }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: { title, columns, rows } });
  } catch (error: any) {
    console.error("REPORT API ERROR:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
