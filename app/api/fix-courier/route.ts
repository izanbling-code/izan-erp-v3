import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const invoices = await prisma.salesInvoice.findMany({
      where: { courierId: null, notes: { contains: "Courier:" } }
    });
    
    let count = 0;
    for (const inv of invoices) {
      const match = inv.notes?.match(/Courier:\s*([^|]+)/i);
      if (match && match[1]) {
        const cName = match[1].trim();
        const courier = await prisma.courier.findFirst({
          where: { companyId: inv.companyId, name: { equals: cName, mode: "insensitive" } }
        });
        if (courier) {
          await prisma.salesInvoice.update({
            where: { id: inv.id },
            data: { courierId: courier.id }
          });
          count++;
        }
      }
    }
    return NextResponse.json({ success: true, message: `Successfully linked ${count} invoices to their Couriers!` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
