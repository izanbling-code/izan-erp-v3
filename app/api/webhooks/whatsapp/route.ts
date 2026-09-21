import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";


export async function POST(req: Request) {
  try {
    // 1. Identify the Tenant (e.g., /api/webhooks/whatsapp?companyId=123)
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId in URL" }, { status: 400 });
    }

    const body = await req.json();

    // 2. Parse standard WhatsApp/Meta webhook payload
    const messageData = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    
    if (!messageData) {
       return NextResponse.json({ status: "ignored", reason: "No message detected" });
    }

    const fromNumber = messageData.from; // Sender's WhatsApp number
    const textBody = messageData.text?.body || "";

    // 3. Retrieve Customer by WhatsApp number
    const customer = await prisma.customer.findFirst({
      where: { whatsapp: fromNumber, companyId }
    });

    if (!customer) {
      return NextResponse.json({ error: "Unregistered customer number" }, { status: 404 });
    }

    // 4. ACID Transaction: Generate sequence and save the Order
    const order = await prisma.$transaction(async (tx) => {
      // Note: sequenceCounter still uses 'tenantId' in the schema, so we map companyId to it
      const counter = await tx.sequenceCounter.upsert({
        where: { tenantId_model: { tenantId: companyId, model: "Order" } },
        update: { nextVal: { increment: 1 } },
        create: { tenantId: companyId, model: "Order", prefix: "ORD-", nextVal: 2 }
      });
      
      const orderNum = `${counter.prefix}${counter.nextVal - 1}`;

      // 5. Commit the Order
      return await tx.order.create({
        data: {
          companyId,
          orderNumber: orderNum,
          customerId: customer.id,
          status: "SALE_ORDER",
          paymentStatus: "PENDING",
          totalAmount: 0, // Placeholder for natural language parsing logic later
          whatsappRef: messageData.id
        }
      });
    });

    return NextResponse.json({ success: true, orderNumber: order.orderNumber });

  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}