import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  try {
    const { orderId, allocations, courierName, bookingRef, deliveryFee, paymentStatus } = await req.json();

    // 1. Fetch the Order with all lines and live stock batches
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
                  orderBy: { batch: { createdAt: 'asc' } } // For FIFO auto-selection
                }
              }
            }
          }
        }
      }
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status !== "SALE_ORDER") return NextResponse.json({ error: "Order already processed" }, { status: 400 });

    // Execute the database write as a transaction so nothing gets partially saved if it fails
    await prisma.$transaction(async (tx) => {
      
      // 2. Create the Official Sales Invoice
      const invoiceCount = await tx.salesInvoice.count({ where: { companyId: order.companyId } });
      const invoiceNo = `INV-${String(invoiceCount + 1).padStart(5, '0')}`;
      
      const invoice = await tx.salesInvoice.create({
        data: {
          companyId: order.companyId,
          customerId: order.customerId,
          invoiceNo,
          invoiceDate: new Date(),
          status: "POSTED",
          subtotal: order.totalAmount,
          deliveryCharges: Number(deliveryFee),
          total: Number(order.totalAmount) + Number(deliveryFee),
          notes: `Generated from Order: ${order.orderNumber}`
        }
      });

      // 3. Process allocations and deduct stock
      for (const line of order.lines) {
        let quantityToDeduct = Number(line.quantity);
        const alloc = allocations[line.id];
        
        let targetBatches = [];
        if (alloc === "AUTO") {
          targetBatches = line.product.stockBatches; // FIFO ordered
        } else {
          const specificBatch = line.product.stockBatches.find((sb: any) => sb.batchId === alloc);
          if (specificBatch) targetBatches = [specificBatch];
        }

        for (const sb of targetBatches) {
          if (quantityToDeduct <= 0) break;

          const availableQty = Number(sb.quantity);
          const deduction = Math.min(availableQty, quantityToDeduct);
          
          // Deduct from StockBatch
          await tx.stockBatch.update({
            where: { id: sb.id },
            data: { quantity: { decrement: deduction } }
          });

          // Log the official Inventory Movement
          await tx.inventoryMovement.create({
            data: {
              companyId: order.companyId,
              productId: line.productId,
              batchId: sb.batchId,
              type: "SALE",
              referenceType: "SALES_INVOICE",
              referenceId: invoice.id,
              quantity: deduction,
              unitCost: Number(line.unitPrice), 
              totalCost: deduction * Number(line.unitPrice)
            }
          });

          // Create the Invoice Line
          await tx.salesInvoiceLine.create({
            data: {
              invoiceId: invoice.id,
              productId: line.productId,
              batchId: sb.batchId,
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

      // 4. Update the Order status to CONFIRMATION
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CONFIRMATION",
          bookingNumber: bookingRef,
          deliveryCharges: Number(deliveryFee),
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
