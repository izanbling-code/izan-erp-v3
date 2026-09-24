import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

function generateBatchNumber() {
  const now = new Date();
  const datePart = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `B-${datePart}-${randomPart}`;
}

async function resolveOrCreate(tx: any, model: string, name: string, companyId: string) {
  if (!name || name.trim() === "") return null;
  const cleanName = name.trim();
  let existing = await tx[model].findFirst({ 
    where: { name: { equals: cleanName, mode: "insensitive" }, companyId } 
  });
  if (existing) return existing.id;
  let created = await tx[model].create({ data: { name: cleanName, companyId } });
  return created.id;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { billId, allocations } = body;

    if (!billId || !allocations || allocations.length === 0) {
      return NextResponse.json({ ok: false, error: "Invalid payload or empty allocations." }, { status: 400 });
    }

    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company found." }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch Original Bill & Verify
      const originalBill = await tx.purchaseBill.findUnique({
        where: { id: billId },
        include: { lines: true }
      });

      if (!originalBill) throw new Error("Purchase Bill not found.");
      if (originalBill.status !== "POSTED") throw new Error("Only posted bills can be allocated.");
      if (originalBill.notes?.includes("[REPACKAGED]")) throw new Error("This bill has already been repackaged/allocated.");

      const warehouseId = originalBill.lines[0]?.warehouseId;
      if (!warehouseId) throw new Error("Could not determine warehouse from original bill lines.");

      // 2. Auto-Create Master Data & Inject New Retail Stock
      for (const line of allocations) {
        let finalCatId = line.categoryId;
        let finalBrandId = line.brandId;
        let finalUnitId = line.unitId;

        if (line.isNewCat) finalCatId = await resolveOrCreate(tx, "category", line.newCatName, company.id);
        if (line.isNewBrand) finalBrandId = await resolveOrCreate(tx, "brand", line.newBrandName, company.id);
        if (line.isNewUnit) finalUnitId = await resolveOrCreate(tx, "unit", line.newUnitName, company.id);

        let finalProductId = line.productId;

        if (line.isNewItem) {
          const sku = `SKU-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 100)}`;
          const cost = Number(line.unitCost) || 0;
          const newProduct = await tx.product.create({
            data: {
              companyId: company.id,
              name: line.name.trim(),
              categoryId: finalCatId || null,
              brandId: finalBrandId || null,
              unitId: finalUnitId || null,
              type: "GOODS",
              costPrice: cost,
              salePrice: cost > 0 ? cost * 1.5 : 0, 
              sku
            }
          });
          finalProductId = newProduct.id;
        }

        const yieldQty = Number(line.yieldQty) || 0;
        const unitCost = Number(line.unitCost) || 0;
        const totalCost = Number(line.totalCost) || 0;
        const batchNum = (line.batchNo && line.batchNo.trim() !== "") ? line.batchNo.trim() : generateBatchNumber();

        const batch = await tx.inventoryBatch.create({
          data: {
            companyId: company.id,
            productId: finalProductId,
            batchNumber: batchNum,
            unitCost: unitCost,
            originalQuantity: yieldQty,
            purchaseBillId: originalBill.id,
            isActive: true,
            purchaseDate: new Date()
          }
        });

        await tx.stockBatch.create({
          data: { batchId: batch.id, productId: finalProductId, warehouseId, quantity: yieldQty }
        });

        const existingStock = await tx.stock.findUnique({
          where: { productId_warehouseId: { productId: finalProductId, warehouseId } }
        });

        if (existingStock) {
          const oldQty = Number(existingStock.quantity);
          const oldAvg = Number(existingStock.averageCost);
          const newQty = oldQty + yieldQty;
          const newAvg = newQty > 0 ? ((oldQty * oldAvg) + (yieldQty * unitCost)) / newQty : unitCost;
          await tx.stock.update({
            where: { id: existingStock.id },
            data: { quantity: newQty, averageCost: newAvg }
          });
        } else {
          await tx.stock.create({
            data: { productId: finalProductId, warehouseId, quantity: yieldQty, averageCost: unitCost }
          });
        }

        // SMART FIX: Map type and referenceType strictly to "PURCHASE" to satisfy Prisma Enums
        await tx.inventoryMovement.create({
          data: {
            companyId: company.id,
            productId: finalProductId,
            batchId: batch.id,
            destinationWarehouseId: warehouseId,
            type: "PURCHASE",
            referenceType: "PURCHASE",
            referenceId: originalBill.id,
            quantity: yieldQty,
            unitCost: unitCost,
            totalCost: totalCost,
            movementDate: new Date(),
            notes: "Repackaged from bulk purchase bill"
          }
        });
      }

      // 3. Deduct Original Bulk Stock
      for (const oldLine of originalBill.lines) {
        const qtyToDeduct = Number(oldLine.quantity);
        if (qtyToDeduct <= 0) continue;

        if (oldLine.batchId) {
          await tx.stockBatch.updateMany({
            where: { batchId: oldLine.batchId, warehouseId: oldLine.warehouseId },
            data: { quantity: { decrement: qtyToDeduct } }
          });
        }

        await tx.stock.update({
          where: { productId_warehouseId: { productId: oldLine.productId, warehouseId: oldLine.warehouseId } },
          data: { quantity: { decrement: qtyToDeduct } }
        });

        // SMART FIX: Map deduction to "PURCHASE" with negative quantities
        await tx.inventoryMovement.create({
          data: {
            companyId: company.id,
            productId: oldLine.productId,
            batchId: oldLine.batchId,
            sourceWarehouseId: oldLine.warehouseId,
            type: "PURCHASE",
            referenceType: "PURCHASE",
            referenceId: originalBill.id,
            quantity: -qtyToDeduct,
            unitCost: Number(oldLine.unitCost),
            totalCost: -(qtyToDeduct * Number(oldLine.unitCost)),
            movementDate: new Date(),
            notes: "Bulk stock consumed for repackaging"
          }
        });
      }

      // 4. Mark Bill as Repackaged
      const updatedNotes = originalBill.notes ? `${originalBill.notes} | [REPACKAGED]` : "[REPACKAGED]";
      await tx.purchaseBill.update({
        where: { id: originalBill.id },
        data: { notes: updatedNotes }
      });

      return true;
    });

    return NextResponse.json({ ok: true, message: "Stock successfully repackaged and allocated." });

  } catch (error: any) {
    console.error("Allocation Error:", error);
    return NextResponse.json({ ok: false, error: error.message || "Failed to allocate stock." }, { status: 500 });
  }
}
