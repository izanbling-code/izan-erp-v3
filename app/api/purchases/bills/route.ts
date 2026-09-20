import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

type PurchaseLineInput = {
  id?: string;
  productId: string;
  batchId?: string | null;
  batchNumber?: string | null;
  quantity: number;
  unitCost: number;
  discount?: number;
  tax?: number;
  warehouseId: string;
  description?: string | null;
};

type PurchaseBillInput = {
  id?: string;
  supplierId: string;
  billNo: string;
  billDate?: string;
  dueDate?: string | null;
  status?: "DRAFT" | "POSTED" | "PARTIAL" | "PAID" | "VOID";
  discount?: number;
  tax?: number;
  notes?: string | null;
  lines: PurchaseLineInput[];
};

type AccountingSettings = {
  apAccountId?: string;
  accountsPayableAccountId?: string;
  taxReceivableAccountId?: string;
  taxPayableAccountId?: string;
  defaultInventoryAccountId?: string;
  inventoryAccountId?: string;
  defaultPurchaseAccountId?: string;
  purchaseAccountId?: string;
};

function decimalNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function cleanString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const result = String(value).trim();
  return result.length > 0 ? result : null;
}

function parseDate(value: unknown, fallback: Date = new Date()): Date {
  if (!value) return fallback;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function generateBatchNumber() {
  const now = new Date();
  const datePart = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `B-${datePart}-${randomPart}`;
}

async function getCompany() {
  return prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
  });
}

async function nextEntryNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const latest = await tx.journalEntry.findFirst({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: { entryNumber: true },
  });
  const match = latest?.entryNumber?.match(/(\d+)$/);
  if (!match) return "JE-000001";
  return `JE-${String(Number(match[1]) + 1).padStart(6, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const company = await getCompany();
    if (!company) {
      return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const search = searchParams.get("search");

    if (id) {
      const bill = await prisma.purchaseBill.findUnique({
        where: { id },
        include: {
          supplier: true,
          company: true,
          lines: {
            include: {
              product: { include: { unit: true, brand: true, category: true } },
              batch: true,
              warehouse: true,
            },
            orderBy: { id: "asc" },
          },
          allocations: { include: { payment: true } },
          journal: { include: { lines: { include: { account: true } } } },
        },
      });

      if (!bill) {
        return NextResponse.json({ ok: false, error: "Purchase bill not found" }, { status: 404 });
      }

      return NextResponse.json({ ok: true, bill });
    }

    const bills = await prisma.purchaseBill.findMany({
      where: {
        companyId: company.id,
        ...(search
          ? {
              OR: [
                { billNo: { contains: search, mode: "insensitive" } },
                { supplier: { name: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        supplier: true,
        lines: { include: { product: true, batch: true, warehouse: true } },
        allocations: true,
      },
      orderBy: { billDate: "desc" },
    });

    return NextResponse.json({ ok: true, bills });
  } catch (error) {
    console.error("GET /api/purchases/bills error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load purchase bills" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PurchaseBillInput;
    const supplierId = cleanString(body.supplierId);
    const billNo = cleanString(body.billNo);

    if (!supplierId) return NextResponse.json({ ok: false, error: "Supplier is required" }, { status: 400 });
    if (!billNo) return NextResponse.json({ ok: false, error: "Bill number is required" }, { status: 400 });
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json({ ok: false, error: "At least one purchase item is required" }, { status: 400 });
    }

    const company = await getCompany();
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, companyId: company.id },
    });
    if (!supplier) return NextResponse.json({ ok: false, error: "Supplier not found" }, { status: 404 });

    const existingBill = await prisma.purchaseBill.findFirst({
      where: { companyId: company.id, billNo },
    });
    if (existingBill) {
      return NextResponse.json({ ok: false, error: `Bill number ${billNo} already exists` }, { status: 409 });
    }

    const lines = body.lines.map((line) => {
      const quantity = decimalNumber(line.quantity);
      const unitCost = decimalNumber(line.unitCost);
      const discount = decimalNumber(line.discount);
      const tax = decimalNumber(line.tax);

      if (!line.productId) throw new Error("Every purchase line must have a product");
      if (!line.warehouseId) throw new Error("Every purchase line must have a warehouse");
      if (quantity <= 0) throw new Error("Purchase quantity must be greater than zero");
      if (unitCost < 0) throw new Error("Purchase cost cannot be negative");

      return {
        ...line,
        quantity,
        unitCost,
        discount,
        tax,
        total: quantity * unitCost - discount + tax,
      };
    });

    const productIds = [...new Set(lines.map((l) => l.productId))];
    const warehouseIds = [...new Set(lines.map((l) => l.warehouseId))];

    const [products, warehouses] = await Promise.all([
      prisma.product.findMany({ where: { companyId: company.id, id: { in: productIds } } }),
      prisma.warehouse.findMany({ where: { companyId: company.id, id: { in: warehouseIds } } }),
    ]);

    if (products.length !== productIds.length) return NextResponse.json({ ok: false, error: "One or more products are invalid" }, { status: 400 });
    if (warehouses.length !== warehouseIds.length) return NextResponse.json({ ok: false, error: "One or more warehouses are invalid" }, { status: 400 });

    const lineSubtotal = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
    const lineDiscount = lines.reduce((s, l) => s + l.discount, 0);
    const lineTax = lines.reduce((s, l) => s + l.tax, 0);

    const totalDiscount = lineDiscount + decimalNumber(body.discount);
    const totalTax = lineTax + decimalNumber(body.tax);
    const total = lineSubtotal - totalDiscount + totalTax;

    const status = body.status === "POSTED" ? "POSTED" : "DRAFT";

    let accounting: AccountingSettings = {};
    if (status === "POSTED") {
      const settings = await prisma.companySettings.findUnique({ where: { companyId: company.id } });
      accounting = (settings?.accounting as AccountingSettings) ?? {};

      const apAccountId = accounting.apAccountId || accounting.accountsPayableAccountId;
      const missing: string[] = [];

      if (!apAccountId) {
        missing.push("Accounts Payable account (Configure apAccountId in Settings > Accounting)");
      }

      if (totalTax > 0 && !(accounting.taxReceivableAccountId || accounting.taxPayableAccountId)) {
        missing.push("Tax account (Configure taxReceivableAccountId in Settings > Accounting)");
      }

      for (const line of lines) {
        const product = products.find((p) => p.id === line.productId)!;
        const invAccount =
          product.inventoryAccountId ||
          product.purchaseAccountId ||
          accounting.defaultInventoryAccountId ||
          accounting.defaultPurchaseAccountId ||
          accounting.inventoryAccountId;

        if (!invAccount) {
          missing.push(`Inventory/Purchase account for "${product.name}" (set on Product or Settings > Accounting)`);
        }
      }

      if (missing.length > 0) {
        return NextResponse.json(
          { ok: false, error: `Cannot post bill — missing GL account mapping: ${[...new Set(missing)].join("; ")}` },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const bill = await tx.purchaseBill.create({
        data: {
          companyId: company.id,
          supplierId: supplier.id,
          billNo,
          billDate: parseDate(body.billDate),
          dueDate: body.dueDate ? parseDate(body.dueDate) : null,
          status,
          subtotal: lineSubtotal,
          discount: totalDiscount,
          tax: totalTax,
          total,
          paid: 0,
          balance: total,
          notes: cleanString(body.notes),
        },
      });

      const journalLines: { accountId: string; description: string; debit: number; credit: number }[] = [];

      for (const line of lines) {
        const product = products.find((p) => p.id === line.productId)!;
        let batch;

        if (line.batchId) {
          batch = await tx.inventoryBatch.findFirst({
            where: { id: line.batchId, companyId: company.id, productId: product.id },
          });
          if (!batch) throw new Error(`Batch not found for ${product.name}`);
        } else {
          let batchNumber = cleanString(line.batchNumber) || generateBatchNumber();
          let existing = await tx.inventoryBatch.findFirst({
            where: { companyId: company.id, productId: product.id, batchNumber },
          });
          while (existing) {
            batchNumber = generateBatchNumber();
            existing = await tx.inventoryBatch.findFirst({
              where: { companyId: company.id, productId: product.id, batchNumber },
            });
          }

          batch = await tx.inventoryBatch.create({
            data: {
              companyId: company.id,
              productId: product.id,
              batchNumber,
              purchaseBillId: bill.id,
              supplierId: supplier.id,
              purchaseDate: bill.billDate,
              unitCost: line.unitCost,
              originalQuantity: line.quantity,
              isActive: true,
            },
          });
        }

        await tx.purchaseBillLine.create({
          data: {
            billId: bill.id,
            productId: product.id,
            batchId: batch.id,
            description: cleanString(line.description),
            quantity: line.quantity,
            unitCost: line.unitCost,
            discount: line.discount,
            tax: line.tax,
            total: line.total,
            warehouseId: line.warehouseId ?? "",
          },
        });

        if (status === "POSTED") {
          const stockBatch = await tx.stockBatch.findUnique({
            where: { batchId_warehouseId: { batchId: batch.id, warehouseId: line.warehouseId ?? "" } },
          });

          if (stockBatch) {
            await tx.stockBatch.update({
              where: { id: stockBatch.id },
              data: { quantity: { increment: line.quantity } },
            });
          } else {
            await tx.stockBatch.create({
              data: { batchId: batch.id, productId: product.id, warehouseId: line.warehouseId ?? "", quantity: line.quantity },
            });
          }

          const existingStock = await tx.stock.findUnique({
            where: { productId_warehouseId: { productId: product.id, warehouseId: line.warehouseId ?? "" } },
          });

          if (existingStock) {
            const oldQty = Number(existingStock.quantity);
            const oldAvg = Number(existingStock.averageCost);
            const newQty = oldQty + line.quantity;
            const newAvg = newQty > 0 ? (oldQty * oldAvg + line.quantity * line.unitCost) / newQty : line.unitCost;

            await tx.stock.update({
              where: { id: existingStock.id },
              data: { quantity: newQty, averageCost: newAvg },
            });
          } else {
            await tx.stock.create({
              data: { productId: product.id, warehouseId: line.warehouseId ?? "", quantity: line.quantity, averageCost: line.unitCost },
            });
          }

          await tx.inventoryMovement.create({
            data: {
              companyId: company.id,
              productId: product.id,
              batchId: batch.id,
              destinationWarehouseId: line.warehouseId,
              type: "PURCHASE",
              referenceType: "PURCHASE",
              referenceId: bill.id,
              quantity: line.quantity,
              unitCost: line.unitCost,
              totalCost: line.quantity * line.unitCost,
              movementDate: bill.billDate,
              notes: `Purchase Bill ${bill.billNo}`,
            },
          });

          const inventoryAccountId =
            product.inventoryAccountId ||
            product.purchaseAccountId ||
            accounting.defaultInventoryAccountId ||
            accounting.defaultPurchaseAccountId ||
            accounting.inventoryAccountId!;

          journalLines.push({
            accountId: inventoryAccountId,
            description: `Inventory Purchase — ${product.name} (${bill.billNo})`,
            debit: line.quantity * line.unitCost - line.discount,
            credit: 0,
          });
        }
      }

      let journalId: string | null = null;
      if (status === "POSTED") {
        const apAccountId = accounting.apAccountId || accounting.accountsPayableAccountId!;
        const taxAcc = accounting.taxReceivableAccountId || accounting.taxPayableAccountId;

        if (totalTax > 0 && taxAcc) {
          journalLines.push({
            accountId: taxAcc,
            description: `Input Tax — Bill ${bill.billNo}`,
            debit: totalTax,
            credit: 0,
          });
        }

        journalLines.push({
          accountId: apAccountId,
          description: `Accounts Payable — Bill ${bill.billNo}`,
          debit: 0,
          credit: total,
        });

        const entryNumber = await nextEntryNumber(tx, company.id);
        const journalEntry = await tx.journalEntry.create({
          data: {
            companyId: company.id,
            entryNumber,
            entryDate: bill.billDate,
            reference: bill.billNo,
            description: `Purchase Bill ${bill.billNo}`,
            status: "POSTED",
            referenceType: "PURCHASE",
            lines: {
              create: journalLines.map((l) => ({
                accountId: l.accountId,
                description: l.description,
                debit: l.debit,
                credit: l.credit,
              })),
            },
          },
        });

        journalId = journalEntry.id;
        await tx.purchaseBill.update({
          where: { id: bill.id },
          data: { journalId },
        });
      }

      return tx.purchaseBill.findUnique({
        where: { id: bill.id },
        include: {
          supplier: true,
          lines: { include: { product: true, batch: true, warehouse: true } },
          journal: { include: { lines: { include: { account: true } } } },
        },
      });
    });

    return NextResponse.json({ ok: true, bill: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/purchases/bills error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create bill" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = cleanString(body.id);
    const action = cleanString(body.action);

    if (!id) return NextResponse.json({ ok: false, error: "Bill ID is required" }, { status: 400 });
    if (action !== "POST" && action !== "REVERSE") {
      return NextResponse.json({ ok: false, error: `Unsupported action: ${action}` }, { status: 400 });
    }

    const company = await getCompany();
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const existing = await prisma.purchaseBill.findFirst({
      where: { id, companyId: company.id },
      include: {
        lines: { include: { product: true, batch: true, warehouse: true } },
        allocations: true,
        journal: { include: { lines: true } },
      },
    });

    if (!existing) return NextResponse.json({ ok: false, error: "Purchase bill not found" }, { status: 404 });

    if (action === "POST") {
      if (existing.status !== "DRAFT") {
        return NextResponse.json({ ok: false, error: `Only draft bills can be posted. Status: ${existing.status}` }, { status: 409 });
      }

      const settings = await prisma.companySettings.findUnique({ where: { companyId: company.id } });
      const accounting = (settings?.accounting as AccountingSettings) ?? {};
      const apAccountId = accounting.apAccountId || accounting.accountsPayableAccountId;

      const missing: string[] = [];
      if (!apAccountId) missing.push("Accounts Payable account (Configure apAccountId in Settings > Accounting)");
      if (Number(existing.tax) > 0 && !(accounting.taxReceivableAccountId || accounting.taxPayableAccountId)) {
        missing.push("Tax account (Configure taxReceivableAccountId in Settings > Accounting)");
      }

      for (const line of existing.lines) {
        const invAccount =
          line.product.inventoryAccountId ||
          line.product.purchaseAccountId ||
          accounting.defaultInventoryAccountId ||
          accounting.defaultPurchaseAccountId ||
          accounting.inventoryAccountId;

        if (!invAccount) missing.push(`Inventory account for "${line.product.name}"`);
      }

      if (missing.length > 0) {
        return NextResponse.json(
          { ok: false, error: `Cannot post bill — missing GL account mapping: ${[...new Set(missing)].join("; ")}` },
          { status: 400 }
        );
      }

      const posted = await prisma.$transaction(async (tx) => {
        const journalLines: { accountId: string; description: string; debit: number; credit: number }[] = [];

        for (const line of existing.lines) {
          const batch = line.batch!;
          const product = line.product;

          const stockBatch = await tx.stockBatch.findUnique({
            where: { batchId_warehouseId: { batchId: batch.id, warehouseId: line.warehouseId ?? "" } },
          });

          if (stockBatch) {
            await tx.stockBatch.update({
              where: { id: stockBatch.id },
              data: { quantity: { increment: line.quantity } },
            });
          } else {
            await tx.stockBatch.create({
              data: { batchId: batch.id, productId: product.id, warehouseId: line.warehouseId ?? "", quantity: line.quantity },
            });
          }

          const existingStock = await tx.stock.findUnique({
            where: { productId_warehouseId: { productId: product.id, warehouseId: line.warehouseId ?? "" } },
          });

          if (existingStock) {
            const oldQty = Number(existingStock.quantity);
            const oldAvg = Number(existingStock.averageCost);
            const newQty = oldQty + Number(line.quantity);
            const newAvg = newQty > 0 ? (oldQty * oldAvg + Number(line.quantity) * Number(line.unitCost)) / newQty : Number(line.unitCost);

            await tx.stock.update({
              where: { id: existingStock.id },
              data: { quantity: newQty, averageCost: newAvg },
            });
          } else {
            await tx.stock.create({
              data: { productId: product.id, warehouseId: line.warehouseId ?? "", quantity: line.quantity, averageCost: line.unitCost },
            });
          }

          await tx.inventoryMovement.create({
            data: {
              companyId: company.id,
              productId: product.id,
              batchId: batch.id,
              destinationWarehouseId: line.warehouseId,
              type: "PURCHASE",
              referenceType: "PURCHASE",
              referenceId: existing.id,
              quantity: line.quantity,
              unitCost: line.unitCost,
              totalCost: Number(line.quantity) * Number(line.unitCost),
              movementDate: existing.billDate,
              notes: `Purchase Bill ${existing.billNo}`,
            },
          });

          const inventoryAccountId =
            product.inventoryAccountId ||
            product.purchaseAccountId ||
            accounting.defaultInventoryAccountId ||
            accounting.defaultPurchaseAccountId ||
            accounting.inventoryAccountId!;

          journalLines.push({
            accountId: inventoryAccountId,
            description: `Inventory Purchase — ${product.name} (${existing.billNo})`,
            debit: Number(line.quantity) * Number(line.unitCost) - Number(line.discount),
            credit: 0,
          });
        }

        const taxAcc = accounting.taxReceivableAccountId || accounting.taxPayableAccountId;
        if (Number(existing.tax) > 0 && taxAcc) {
          journalLines.push({
            accountId: taxAcc,
            description: `Input Tax — Bill ${existing.billNo}`,
            debit: Number(existing.tax),
            credit: 0,
          });
        }

        journalLines.push({
          accountId: apAccountId!,
          description: `Accounts Payable — Bill ${existing.billNo}`,
          debit: 0,
          credit: Number(existing.total),
        });

        const entryNumber = await nextEntryNumber(tx, company.id);
        const journalEntry = await tx.journalEntry.create({
          data: {
            companyId: company.id,
            entryNumber,
            entryDate: existing.billDate,
            reference: existing.billNo,
            description: `Purchase Bill ${existing.billNo}`,
            status: "POSTED",
            referenceType: "PURCHASE",
            lines: {
              create: journalLines.map((l) => ({
                accountId: l.accountId,
                description: l.description,
                debit: l.debit,
                credit: l.credit,
              })),
            },
          },
        });

        return tx.purchaseBill.update({
          where: { id: existing.id },
          data: { status: "POSTED", journalId: journalEntry.id },
          include: {
            supplier: true,
            lines: { include: { product: true, batch: true, warehouse: true } },
            journal: { include: { lines: { include: { account: true } } } },
          },
        });
      });

      return NextResponse.json({ ok: true, message: "Purchase bill posted successfully", bill: posted });
    }

    // REVERSE WORKFLOW
    if (existing.status !== "POSTED" && existing.status !== "PARTIAL" && existing.status !== "PAID") {
      return NextResponse.json({ ok: false, error: `Bill cannot be reversed from status ${existing.status}` }, { status: 409 });
    }

    if (existing.allocations.length > 0) {
      return NextResponse.json({ ok: false, error: "This bill has payment allocations. Remove payments first." }, { status: 409 });
    }

    const reversed = await prisma.$transaction(async (tx) => {
      for (const line of existing.lines) {
        const stockBatch = await tx.stockBatch.findUnique({
          where: { batchId_warehouseId: { batchId: line.batchId ?? "", warehouseId: line.warehouseId ?? "" } },
        });

        if (stockBatch) {
          await tx.stockBatch.update({
            where: { id: stockBatch.id },
            data: { quantity: { decrement: line.quantity } },
          });
        }

        const stock = await tx.stock.findUnique({
          where: { productId_warehouseId: { productId: line.productId, warehouseId: line.warehouseId ?? "" } },
        });

        if (stock) {
          await tx.stock.update({
            where: { id: stock.id },
            data: { quantity: { decrement: line.quantity } },
          });
        }

        await tx.inventoryMovement.create({
          data: {
            companyId: company.id,
            productId: line.productId,
            batchId: line.batchId ?? "",
            destinationWarehouseId: line.warehouseId,
            type: "PURCHASE",
            referenceType: "PURCHASE",
            referenceId: existing.id,
            quantity: -Number(line.quantity),
            unitCost: Number(line.unitCost),
            totalCost: -Number(line.quantity) * Number(line.unitCost),
            movementDate: new Date(),
            notes: `Reversal of Purchase Bill ${existing.billNo}`,
          },
        });
      }

      if (existing.journal) {
        const reversalLines = existing.journal.lines.map((l) => ({
          accountId: l.accountId,
          description: `Reversal — ${l.description ?? existing.billNo}`,
          debit: Number(l.credit),
          credit: Number(l.debit),
        }));

        const entryNumber = await nextEntryNumber(tx, company.id);
        await tx.journalEntry.create({
          data: {
            companyId: company.id,
            entryNumber,
            entryDate: new Date(),
            reference: `REV-${existing.billNo}`,
            description: `Reversal of Purchase Bill ${existing.billNo}`,
            status: "POSTED",
            referenceType: "PURCHASE",
            lines: { create: reversalLines },
          },
        });
      }

      return tx.purchaseBill.update({
        where: { id: existing.id },
        data: { status: "VOID", balance: 0 },
      });
    });

    return NextResponse.json({ ok: true, message: "Purchase bill reversed successfully", bill: reversed });
  } catch (error) {
    console.error("PATCH /api/purchases/bills error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to execute action" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ ok: false, error: "Bill ID is required" }, { status: 400 });

    const company = await getCompany();
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const bill = await prisma.purchaseBill.findUnique({
      where: { id },
      include: { allocations: true, lines: true },
    });

    if (!bill) return NextResponse.json({ ok: false, error: "Purchase bill not found" }, { status: 404 });

    if (bill.status === "POSTED" || bill.status === "PARTIAL" || bill.status === "PAID") {
      return NextResponse.json({ ok: false, error: "Posted bills cannot be deleted. Reverse the bill instead." }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.purchaseBill.delete({ where: { id } });
      await tx.inventoryBatch.deleteMany({
        where: {
          purchaseBillId: id,
          stockBatches: { none: { quantity: { gt: 0 } } },
          salesLines: { none: {} },
        },
      });
    });

    return NextResponse.json({ ok: true, message: "Draft purchase bill deleted." });
  } catch (error) {
    console.error("DELETE /api/purchases/bills error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to delete bill" },
      { status: 500 }
    );
  }
}
