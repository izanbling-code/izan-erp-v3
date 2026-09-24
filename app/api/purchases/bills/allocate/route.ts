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
  let existing = await tx[model].findFirst({ where: { name: { equals: cleanName, mode: "insensitive" }, companyId } });
  if (existing) return existing.id;
  let created = await tx[model].create({ data: { name: cleanName, companyId } });
  return created.id;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const billId = searchParams.get("billId");
    if (!billId) return NextResponse.json({ ok: false, error: "Bill ID required" }, { status: 400 });

    const movements = await prisma.inventoryMovement.findMany({
      where: { referenceId: billId, notes: "Repackaged from bulk purchase bill" },
      include: { product: { include: { category: true, brand: true, unit: true } } }
    });

    return NextResponse.json({ ok: true, allocations: movements });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: "Failed to load allocation data" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { billId, allocations } = body;
    if (!billId || !allocations || allocations.length === 0) return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });

    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company found." }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const originalBill = await tx.purchaseBill.findUnique({ where: { id: billId }, include: { lines: true } });
      if (!originalBill || originalBill.status !== "POSTED" || originalBill.notes?.includes("[REPACKAGED]")) throw new Error("Invalid bill state for allocation.");

      const warehouseId = originalBill.lines[0]?.warehouseId;
      if (!warehouseId) throw new Error("Could not determine warehouse.");

      for (const line of allocations) {
        let finalCatId = line.categoryId; let finalBrandId = line.brandId; let finalUnitId = line.unitId;
        if (line.isNewCat) finalCatId = await resolveOrCreate(tx, "category", line.newCatName, company.id);
        if (line.isNewBrand) finalBrandId = await resolveOrCreate(tx, "brand", line.newBrandName, company.id);
        if (line.isNewUnit) finalUnitId = await resolveOrCreate(tx, "unit", line.newUnitName, company.id);

        let finalProductId = line.productId;
        if (line.isNewItem) {
          const sku = `SKU-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 100)}`;
          const cost = Number(line.unitCost) || 0;
          const newProduct = await tx.product.create({
            data: { companyId: company.id, name: line.name.trim(), categoryId: finalCatId || null, brandId: finalBrandId || null, unitId: finalUnitId || null, type: "GOODS", costPrice: cost, salePrice: cost > 0 ? cost * 1.5 : 0, sku }
          });
          finalProductId = newProduct.id;
        }

        const yieldQty = Number(line.yieldQty) || 0; const unitCost = Number(line.unitCost) || 0; const totalCost = Number(line.totalCost) || 0;
        const batchNum = (line.batchNo && line.batchNo.trim() !== "") ? line.batchNo.trim() : generateBatchNumber();

        const batch = await tx.inventoryBatch.create({
          data: { companyId: company.id, productId: finalProductId, batchNumber: batchNum, unitCost: unitCost, originalQuantity: yieldQty, purchaseBillId: originalBill.id, isActive: true, purchaseDate: new Date() }
        });

        await tx.stockBatch.create({ data: { batchId: batch.id, productId: finalProductId, warehouseId, quantity: yieldQty } });

        const existingStock = await tx.stock.findUnique({ where: { productId_warehouseId: { productId: finalProductId, warehouseId } } });
        if (existingStock) {
          const oldQty = Number(existingStock.quantity); const oldAvg = Number(existingStock.averageCost); const newQty = oldQty + yieldQty;
          const newAvg = newQty > 0 ? ((oldQty * oldAvg) + (yieldQty * unitCost)) / newQty : unitCost;
          await tx.stock.update({ where: { id: existingStock.id }, data: { quantity: newQty, averageCost: newAvg } });
        } else {
          await tx.stock.create({ data: { productId: finalProductId, warehouseId, quantity: yieldQty, averageCost: unitCost } });
        }

        await tx.inventoryMovement.create({
          data: { companyId: company.id, productId: finalProductId, batchId: batch.id, destinationWarehouseId: warehouseId, type: "PURCHASE", referenceType: "PURCHASE", referenceId: originalBill.id, quantity: yieldQty, unitCost: unitCost, totalCost: totalCost, movementDate: new Date(), notes: "Repackaged from bulk purchase bill" }
        });
      }

      for (const oldLine of originalBill.lines) {
        const qtyToDeduct = Number(oldLine.quantity);
        if (qtyToDeduct <= 0) continue;
        if (oldLine.batchId) { await tx.stockBatch.updateMany({ where: { batchId: oldLine.batchId, warehouseId: oldLine.warehouseId }, data: { quantity: { decrement: qtyToDeduct } } }); }
        await tx.stock.update({ where: { productId_warehouseId: { productId: oldLine.productId, warehouseId: oldLine.warehouseId } }, data: { quantity: { decrement: qtyToDeduct } } });

        await tx.inventoryMovement.create({
          data: { companyId: company.id, productId: oldLine.productId, batchId: oldLine.batchId, sourceWarehouseId: oldLine.warehouseId, type: "PURCHASE", referenceType: "PURCHASE", referenceId: originalBill.id, quantity: -qtyToDeduct, unitCost: Number(oldLine.unitCost), totalCost: -(qtyToDeduct * Number(oldLine.unitCost)), movementDate: new Date(), notes: "Bulk stock consumed for repackaging" }
        });
      }

      const updatedNotes = originalBill.notes ? `${originalBill.notes} | [REPACKAGED]` : "[REPACKAGED]";
      await tx.purchaseBill.update({ where: { id: originalBill.id }, data: { notes: updatedNotes } });

      return true;
    });

    return NextResponse.json({ ok: true, message: "Stock successfully repackaged and allocated." });
  } catch (error: any) { return NextResponse.json({ ok: false, error: error.message || "Failed to allocate stock." }, { status: 500 }); }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const billId = searchParams.get("billId");
    if (!billId) return NextResponse.json({ ok: false, error: "Bill ID required" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      const originalBill = await tx.purchaseBill.findUnique({ where: { id: billId } });
      if (!originalBill || !originalBill.notes?.includes("[REPACKAGED]")) throw new Error("Bill is not repackaged.");

      // Reverse IN movements
      const inMovements = await tx.inventoryMovement.findMany({ where: { referenceId: billId, notes: "Repackaged from bulk purchase bill" } });
      for (const mov of inMovements) {
        if (mov.batchId) await tx.stockBatch.updateMany({ where: { batchId: mov.batchId, warehouseId: mov.destinationWarehouseId! }, data: { quantity: { decrement: mov.quantity } } });
        await tx.stock.update({ where: { productId_warehouseId: { productId: mov.productId, warehouseId: mov.destinationWarehouseId! } }, data: { quantity: { decrement: mov.quantity } } });
      }

      // Reverse OUT movements
      const outMovements = await tx.inventoryMovement.findMany({ where: { referenceId: billId, notes: "Bulk stock consumed for repackaging" } });
      for (const mov of outMovements) {
        if (mov.batchId) await tx.stockBatch.updateMany({ where: { batchId: mov.batchId, warehouseId: mov.sourceWarehouseId! }, data: { quantity: { increment: Math.abs(Number(mov.quantity)) } } });
        await tx.stock.update({ where: { productId_warehouseId: { productId: mov.productId, warehouseId: mov.sourceWarehouseId! } }, data: { quantity: { increment: Math.abs(Number(mov.quantity)) } } });
      }

      await tx.inventoryMovement.deleteMany({ where: { referenceId: billId, notes: { in: ["Repackaged from bulk purchase bill", "Bulk stock consumed for repackaging"] } } });

      const newNotes = originalBill.notes.replace(" | [REPACKAGED]", "").replace("[REPACKAGED]", "");
      await tx.purchaseBill.update({ where: { id: originalBill.id }, data: { notes: newNotes === "" ? null : newNotes } });
    });

    return NextResponse.json({ ok: true, message: "Allocation successfully undone." });
  } catch (error: any) { return NextResponse.json({ ok: false, error: error.message || "Failed to undo allocation." }, { status: 500 }); }
}
