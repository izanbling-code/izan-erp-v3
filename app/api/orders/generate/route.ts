import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  try {
    const { orderId, allocations, courierName, bookingRef, deliveryFee, paymentStatus } = await req.json();

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        lines: {
          include: {
            product: {
              include: {
                stockBatches: {
                  where: { quantity: { gt: 0 } },
                  orderBy: { batch: { createdAt: 'asc' } }
                }
              }
            }
          }
        }
      }
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status !== "SALE_ORDER") return NextResponse.json({ error: "Order already processed" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      
      const invoiceCount = await tx.salesInvoice.count({ where: { companyId: order.companyId } });
      const invoiceNo = `INV-${String(invoiceCount + 1).padStart(5, '0')}`;
      
      const deliveryCost = Number(deliveryFee) || 0;
      const orderTotal = Number(order.totalAmount) || 0;

      // 1. Create Invoice in DRAFT status. 
      // Inject Courier, Tracking, and Payment Mode into the notes so it is visible in the Invoice module.
      const invoice = await tx.salesInvoice.create({
        data: {
          companyId: order.companyId,
          customerId: order.customerId,
          invoiceNo,
          invoiceDate: new Date(),
          status: "DRAFT",
          subtotal: orderTotal,
          deliveryCharges: deliveryCost,
          total: orderTotal + deliveryCost,
          notes: `Order: ${order.orderNumber} | Courier: ${courierName || 'N/A'} | Tracking: ${bookingRef || 'N/A'} | Payment: ${paymentStatus}`
        }
      });

      for (const line of order.lines) {
        let quantityToDeduct = Number(line.quantity);
        const alloc = allocations[line.id];
        
        let targetBatches = [];
        if (alloc === "AUTO") {
          targetBatches = line.product.stockBatches;
        } else {
          const specificBatch = line.product.stockBatches.find((sb: any) => sb.batchId === alloc);
          if (specificBatch) targetBatches = [specificBatch];
        }

        for (const sb of targetBatches) {
          if (quantityToDeduct <= 0) break;

          const availableQty = Number(sb.quantity);
          const deduction = Math.min(availableQty, quantityToDeduct);
          
          await tx.stockBatch.update({
            where: { id: sb.id },
            data: { quantity: { decrement: deduction } }
          });

          await tx.inventoryMovement.create({
            data: {
              companyId: order.companyId,
              productId: line.productId,
              batchId: sb.batchId,
              sourceWarehouseId: sb.warehouseId,
              type: "SALE",
              referenceType: "SALES_INVOICE",
              referenceId: invoice.id,
              quantity: deduction,
              unitCost: Number(line.unitPrice), 
              totalCost: deduction * Number(line.unitPrice)
            }
          });

          // 2. Map warehouseId and batchId to Invoice Line so it populates the Edit screen
          await tx.salesInvoiceLine.create({
            data: {
              invoiceId: invoice.id,
              productId: line.productId,
              batchId: sb.batchId,
              warehouseId: sb.warehouseId, 
              quantity: deduction,
              unitPrice: line.unitPrice,
              total: deduction * Number(line.unitPrice)
            }
          });

          quantityToDeduct -= deduction;
        }

        if (quantityToDeduct > 0) {
          throw new Error(`Insufficient stock for product: ${line.product.name}`);
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CONFIRMATION",
          bookingNumber: bookingRef,
          deliveryCharges: deliveryCost,
          paymentStatus
        }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Generation Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
