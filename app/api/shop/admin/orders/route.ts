import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const orders = await prisma.order.findMany({
      where: { companyId: company.id },
      include: { customer: true, lines: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(orders);
  } catch (error: any) {
    return NextResponse.json([], { status: 500 });
  }
}

// NEW: Save edited tracking numbers with auto-cleanup
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "Order ID required" }, { status: 400 });

    // Auto-clean the tracking number: remove spaces, pipes, and special characters.
    // This ensures only standard letters and numbers are saved to the database.
    const cleanTracking = body.bookingNumber 
      ? body.bookingNumber.replace(/[^a-zA-Z0-9]/g, '') 
      : null;

    const updated = await prisma.order.update({
      where: { id: body.id },
      data: { bookingNumber: cleanTracking }
    });
    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update tracking ID" }, { status: 500 });
  }
}
