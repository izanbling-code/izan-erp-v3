import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  try {
    const { cart, details } = await req.json();
    
    // We assume a single primary company for the storefront
    const company = await prisma.company.findFirst();
    if (!company) throw new Error("No company found in database");

    // 1. Find or create the customer based on phone number
    let customer = await prisma.customer.findFirst({
      where: { phone: details.phone, companyId: company.id }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          companyId: company.id,
          name: details.name,
          phone: details.phone,
          address: details.address,
        }
      });
    }

    // 2. Calculate totals and generate a random order number
    const totalAmount = cart.reduce((sum: number, item: any) => sum + (item.price * item.qty), 0);
    const orderNumber = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

    // 3. Create the Order and OrderLines in a transaction
    const order = await prisma.order.create({
      data: {
        companyId: company.id,
        orderNumber,
        customerId: customer.id,
        status: "SALE_ORDER",
        paymentStatus: details.paymentStatus === "Uploaded Slip" ? "PENDING" : "PENDING",
        totalAmount,
        paymentSlipUrl: details.paymentRef || null,
        lines: {
          create: cart.map((item: any) => ({
            companyId: company.id,
            productId: item.id,
            quantity: item.qty,
            unitPrice: item.price,
            subtotal: item.price * item.qty,
          }))
        }
      }
    });

    return NextResponse.json({ success: true, orderId: order.id, orderNumber });
  } catch (error) {
    console.error("Checkout Error:", error);
    return NextResponse.json({ error: "Failed to process order" }, { status: 500 });
  }
}
