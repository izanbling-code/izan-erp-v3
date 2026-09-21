import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let company = await prisma.company.findFirst();
    
    if (!company) {
      return NextResponse.json({ error: "No master company found in ERP." }, { status: 500 });
    }

    // 1. Find or Create the Customer based on Phone Number
    let customer = await prisma.customer.findFirst({
      where: { companyId: company.id, phone: body.customer.phone }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          companyId: company.id,
          name: body.customer.name,
          phone: body.customer.phone,
          address: body.customer.address,
          whatsapp: body.customer.phone // Save phone to WhatsApp field for easy contact
        }
      });
    }

    // 2. Generate Order Number
    const orderCount = await prisma.order.count({ where: { companyId: company.id } });
    const orderNumber = `ORD-${String(orderCount + 1).padStart(5, '0')}`;

    // 3. Create the Order (Using your strict schema enums)
    const order = await prisma.order.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        orderNumber: orderNumber,
        status: "SALE_ORDER",
        paymentStatus: "PENDING",
        totalAmount: Number(body.total),
        paymentSlipUrl: body.paymentSlipUrl || null,
        // Passing delivery address and payment method to whatsappRef since your Order model has no notes field
        whatsappRef: `Delivery: ${body.customer.address} | Method: ${body.paymentMethod}` 
      }
    });

    // 4. Create the Order Lines (Items)
    for (const item of body.items) {
      await prisma.orderLine.create({
        data: {
          orderId: order.id,
          productId: item.id,
          companyId: company.id,
          quantity: 1, // Modify this later if you allow qty > 1 in cart
          unitPrice: Number(item.salePrice),
          subtotal: Number(item.salePrice)
        }
      });
    }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error: any) {
    console.error("Strict Checkout Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process order. Schema mismatch." }, { status: 500 });
  }
}
