import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const deletedPayments = await prisma.payment.deleteMany({
      where: { paymentNo: { startsWith: "REC-POPUP-" } }
    });

    const deletedInvoices = await prisma.salesInvoice.deleteMany({
      where: { invoiceNo: { startsWith: "INV-POPUP-" } }
    });

    const resetEvents = await prisma.eventPlanner.updateMany({
      where: { status: "POSTED" },
      data: { status: "DRAFT" }
    });

    return NextResponse.json({ 
      ok: true, 
      message: `SUCCESS! Vaporized ${deletedPayments.count} cash payments and ${deletedInvoices.count} automated invoices. Unlocked ${resetEvents.count} events.` 
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}