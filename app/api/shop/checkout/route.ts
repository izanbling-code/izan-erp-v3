import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }

    const customerInput = body.customer;
    if (!customerInput || !customerInput.name || !customerInput.phone || !customerInput.address) {
      return NextResponse.json({ error: "Customer details are required." }, { status: 400 });
    }

    const company = await prisma.company.findFirst();
    if (!company) {
      return NextResponse.json({ error: "No master company found in ERP." }, { status: 500 });
    }

    const productIds = body.items.map((item: any) => item.id).filter(Boolean);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, companyId: company.id, isActive: true },
    });

    const productMap = new Map(dbProducts.map((product) => [product.id, product]));
    const invalidProduct = body.items.find((item: any) => !productMap.has(item.id));
    if (invalidProduct) {
      return NextResponse.json({ error: `Product ${invalidProduct.id} is unavailable.` }, { status: 400 });
    }

    const orderItems = body.items.map((item: any) => {
      const product = productMap.get(item.id)!;
      const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
      const unitPrice = Number(product.salePrice || product.salesPrice || product.costPrice || 0);
      return {
        productId: product.id,
        quantity,
        unitPrice,
        subtotal: unitPrice * quantity,
      };
    });

    const computedTotal = orderItems.reduce((sum: number, item: { subtotal: number }) => sum + item.subtotal, 0);
    const customerPhone = String(customerInput.phone).trim();

    let customer = await prisma.customer.findFirst({
      where: { companyId: company.id, phone: customerPhone },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          companyId: company.id,
          name: String(customerInput.name).trim(),
          phone: customerPhone,
          address: String(customerInput.address).trim(),
          whatsapp: customerPhone,
        },
      });
    }

    const lastOrder = await prisma.order.findFirst({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
    });

    let nextNumber = 1;
    if (lastOrder && lastOrder.orderNumber) {
      const match = lastOrder.orderNumber.replace(/\D/g, "");
      if (match) nextNumber = parseInt(match, 10) + 1;
    }

    const orderNumber = `ORD-${String(nextNumber).padStart(4, "0")}`;

    const order = await prisma.order.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        orderNumber,
        status: "SALE_ORDER",
        paymentStatus: "PENDING",
        totalAmount: computedTotal,
        paymentSlipUrl: body.paymentSlipUrl || null,
        whatsappRef: `Delivery: ${String(customerInput.address).trim()} | Method: ${String(body.paymentMethod || "LATER")}`,
        lines: {
          create: orderItems.map((item: { productId: string; quantity: number; unitPrice: number; subtotal: number }) => ({
            productId: item.productId,
            companyId: company.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          })),
        },
      },
    });

    return NextResponse.json({ success: true, orderId: order.id, total: computedTotal });
  } catch (error: any) {
    console.error("Strict Checkout Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process order." }, { status: 500 });
  }
}
