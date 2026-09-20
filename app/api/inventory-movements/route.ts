import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

const MOVEMENT_TYPES = [
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "OPENING",
] as const;

type MovementType = (typeof MOVEMENT_TYPES)[number];

function isMovementType(value: unknown): value is MovementType {
  return (
    typeof value === "string" &&
    (MOVEMENT_TYPES as readonly string[]).includes(value)
  );
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function cleanString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const valueString = String(value).trim();
  return valueString.length > 0 ? valueString : null;
}

function parseDate(value: unknown): Date {
  if (!value) {
    return new Date();
  }

  const date = new Date(String(value));

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function generateBatchNumber(prefix: string): string {
  const now = new Date();

  const datePart = now
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);

  const randomPart = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();

  return `${prefix}-${datePart}-${randomPart}`;
}

/* ============================================================
   GET
   ============================================================ */

export async function GET() {
  try {
    const company = await prisma.company.findFirst({
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!company) {
      return NextResponse.json(
        {
          ok: false,
          error: "No company has been configured yet.",
        },
        { status: 400 }
      );
    }

    const companyId = company.id;

    const [movements, products, warehouses, batches] =
      await Promise.all([
        prisma.inventoryMovement.findMany({
          where: {
            companyId,
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
            batch: {
              select: {
                id: true,
                batchNumber: true,
                unitCost: true,
                originalQuantity: true,
              },
            },
            sourceWarehouse: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            destinationWarehouse: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
          orderBy: {
            movementDate: "desc",
          },
        }),

        prisma.product.findMany({
          where: {
            companyId,
            isActive: true,
            type: "PRODUCT",
          },
          select: {
            id: true,
            name: true,
            sku: true,
            costPrice: true,
            reorderLevel: true,
          },
          orderBy: {
            name: "asc",
          },
        }),

        prisma.warehouse.findMany({
          where: {
            companyId,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            code: true,
          },
          orderBy: {
            name: "asc",
          },
        }),

        prisma.inventoryBatch.findMany({
          where: {
            companyId,
            isActive: true,
            product: {
              isActive: true,
              type: "PRODUCT",
            },
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
            stockBatches: {
              include: {
                warehouse: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
          orderBy: {
            purchaseDate: "asc",
          },
        }),
      ]);

    return NextResponse.json({
      ok: true,
      movements,
      products,
      warehouses,
      batches,
    });
  } catch (error) {
    console.error(
      "GET /api/inventory-movements error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load inventory movements.",
      },
      { status: 500 }
    );
  }
}

/* ============================================================
   POST
   ============================================================ */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsedProductId = cleanString(body.productId);

    if (!parsedProductId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Product is required.",
        },
        { status: 400 }
      );
    }

    const movementTypeValue = cleanString(body.movementType);

    if (!isMovementType(movementTypeValue)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid movement type.",
        },
        { status: 400 }
      );
    }

    const movementType: MovementType = movementTypeValue;

    if (!parsedProductId) { return NextResponse.json({ ok: false, error: "Product is required" }, { status: 400 }); }

    const productId: string = parsedProductId; 
const batchId = cleanString(body.batchId);

    const quantity = toNumber(body.quantity);
    const requestedUnitCost = toNumber(body.unitCost);

    if (quantity <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Quantity must be greater than zero.",
        },
        { status: 400 }
      );
    }

    if (requestedUnitCost < 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unit cost cannot be negative.",
        },
        { status: 400 }
      );
    }

    const sourceWarehouseId = cleanString(
      body.sourceWarehouseId
    );

    const destinationWarehouseId = cleanString(
      body.destinationWarehouseId
    );

    const notes = cleanString(body.notes);
    const movementDate = parseDate(body.movementDate);

    /* --------------------------------------------------------
       COMPANY
       -------------------------------------------------------- */

    const company = await prisma.company.findFirst({
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!company) {
      return NextResponse.json(
        {
          ok: false,
          error: "No company has been configured yet.",
        },
        { status: 400 }
      );
    }

    const companyId = company.id;

    /* --------------------------------------------------------
       PRODUCT
       -------------------------------------------------------- */

    const product = await prisma.product.findFirst({
      where: {
        id: productId, 
        companyId,
        isActive: true,
        type: "PRODUCT",
      },
      select: {
        id: true,
        name: true,
        sku: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        {
          ok: false,
          error: "Product not found.",
        },
        { status: 404 }
      );
    }

    /* --------------------------------------------------------
       WAREHOUSE VALIDATION
       -------------------------------------------------------- */

    if (
      movementType === "ADJUSTMENT_IN" ||
      movementType === "OPENING"
    ) {
      if (!destinationWarehouseId) {
        return NextResponse.json(
          {
            ok: false,
            error: "Destination warehouse is required.",
          },
          { status: 400 }
        );
      }
    }

    if (movementType === "ADJUSTMENT_OUT") {
      if (!sourceWarehouseId) {
        return NextResponse.json(
          {
            ok: false,
            error: "Source warehouse is required.",
          },
          { status: 400 }
        );
      }
    }

    if (
      movementType === "TRANSFER_IN" ||
      movementType === "TRANSFER_OUT"
    ) {
      if (
        !sourceWarehouseId ||
        !destinationWarehouseId
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Source and destination warehouses are required.",
          },
          { status: 400 }
        );
      }

      if (
        sourceWarehouseId ===
        destinationWarehouseId
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Source and destination warehouses must be different.",
          },
          { status: 400 }
        );
      }
    }

    const warehouseIds = [
      sourceWarehouseId,
      destinationWarehouseId,
    ].filter(
      (id): id is string => Boolean(id)
    );

    if (warehouseIds.length > 0) {
      const warehouses =
        await prisma.warehouse.findMany({
          where: {
            companyId,
            id: {
              in: warehouseIds,
            },
            isActive: true,
          },
          select: {
            id: true,
          },
        });

      if (
        warehouses.length !==
        new Set(warehouseIds).size
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "One or more selected warehouses are invalid.",
          },
          { status: 400 }
        );
      }
    }

    /* ========================================================
       TRANSACTION
       ======================================================== */

    const result = await prisma.$transaction(
      async (tx) => {
        /* ----------------------------------------------------
           GET TOTAL STOCK
           ---------------------------------------------------- */

        async function getStock(
          warehouseId: string
        ) {
          return tx.stock.findUnique({
            where: {
              productId_warehouseId: {
                productId, 
                warehouseId,
              },
            },
          });
        }

        /* ----------------------------------------------------
           GET BATCH
           ---------------------------------------------------- */

        async function getBatch() {
          if (!batchId) {
            return null;
          }

          const batch =
            await tx.inventoryBatch.findFirst({
              where: {
                id: batchId,
                companyId,
                productId, 
              },
              include: { stockBatches: true },
            });

          if (!batch) {
            throw new Error(
              "Selected batch was not found for this product."
            );
          }

          return batch;
        }

        /* ----------------------------------------------------
           CREATE OPENING / ADJUSTMENT BATCH
           ---------------------------------------------------- */

        async function createOpeningBatch(
          unitCost: number
        ) {
          let batchNumber =
            cleanString(body.batchNumber) ??
            generateBatchNumber(
              movementType === "OPENING"
                ? "OPEN"
                : "ADJ"
            );

          let existing =
            await tx.inventoryBatch.findFirst({
              where: {
                companyId,
                productId, 
                batchNumber,
              },
              select: {
                id: true,
              },
            });

          while (existing) {
            batchNumber =
              generateBatchNumber(
                movementType === "OPENING"
                  ? "OPEN"
                  : "ADJ"
              );

            existing =
              await tx.inventoryBatch.findFirst({
                where: {
                  companyId,
                  productId, 
                  batchNumber,
                },
                select: {
                  id: true,
                },
              });
          }

          return tx.inventoryBatch.create({
            data: {
              companyId,
              productId, 
              batchNumber,
              purchaseDate: movementDate,
              unitCost,
              originalQuantity: quantity,
              isActive: true,
            },
            include: { stockBatches: true },
          });
        }

        /* ----------------------------------------------------
           INCREASE BATCH STOCK
           ---------------------------------------------------- */

        async function increaseBatchStock(
          targetBatchId: string,
          warehouseId: string,
          qty: number
        ) {
          const existing =
            await tx.stockBatch.findUnique({
              where: {
                batchId_warehouseId: {
                  batchId: targetBatchId,
                  warehouseId,
                },
              },
            });

          if (existing) {
            return tx.stockBatch.update({
              where: {
                id: existing.id,
              },
              data: {
                quantity: {
                  increment: qty,
                },
              },
            });
          }

          return tx.stockBatch.create({
            data: {
              batchId: targetBatchId,
              productId, 
              warehouseId,
              quantity: qty,
            },
          });
        }

        /* ----------------------------------------------------
           DECREASE BATCH STOCK
           ---------------------------------------------------- */

        async function decreaseBatchStock(
          targetBatchId: string,
          warehouseId: string,
          qty: number
        ) {
          const stockBatch =
            await tx.stockBatch.findUnique({
              where: {
                batchId_warehouseId: {
                  batchId: targetBatchId,
                  warehouseId,
                },
              },
            });

          if (!stockBatch) {
            throw new Error(
              "Selected batch has no stock in the selected warehouse."
            );
          }

          const available = toNumber(
            stockBatch.quantity
          );

          if (available < qty) {
            throw new Error(
              `Insufficient batch stock. Available quantity is ${available}.`
            );
          }

          return tx.stockBatch.update({
            where: {
              id: stockBatch.id,
            },
            data: {
              quantity: {
                decrement: qty,
              },
            },
          });
        }

        /* ----------------------------------------------------
           INCREASE TOTAL STOCK
           ---------------------------------------------------- */

        async function increaseTotalStock(
          warehouseId: string,
          qty: number,
          cost: number
        ) {
          const stock =
            await getStock(warehouseId);

          if (!stock) {
            return tx.stock.create({
              data: {
                productId, 
                warehouseId,
                quantity: qty,
                averageCost: cost,
              },
            });
          }

          const currentQuantity =
            toNumber(stock.quantity);

          const currentAverageCost =
            toNumber(stock.averageCost);

          const newQuantity =
            currentQuantity + qty;

          const newAverageCost =
            newQuantity > 0
              ? (
                  currentQuantity *
                    currentAverageCost +
                  qty * cost
                ) / newQuantity
              : cost;

          return tx.stock.update({
            where: {
              id: stock.id,
            },
            data: {
              quantity: newQuantity,
              averageCost: newAverageCost,
            },
          });
        }

        /* ----------------------------------------------------
           DECREASE TOTAL STOCK
           ---------------------------------------------------- */

        async function decreaseTotalStock(
          warehouseId: string,
          qty: number
        ) {
          const stock =
            await getStock(warehouseId);

          if (!stock) {
            throw new Error(
              "Stock record not found for the selected warehouse."
            );
          }

          const available = toNumber(
            stock.quantity
          );

          if (available < qty) {
            throw new Error(
              `Insufficient stock. Available quantity is ${available}.`
            );
          }

          return tx.stock.update({
            where: {
              id: stock.id,
            },
            data: {
              quantity: {
                decrement: qty,
              },
            },
          });
        }

        /* ====================================================
           ADJUSTMENT IN
           ==================================================== */

        if (
          movementType ===
          "ADJUSTMENT_IN"
        ) {
          let batch = await getBatch();

          if (!batch) {
            batch =
              await createOpeningBatch(
                requestedUnitCost
              );
          } else if (
            requestedUnitCost > 0 &&
            Number(batch.unitCost) !==
              requestedUnitCost
          ) {
            throw new Error(
              `Batch ${batch.batchNumber} already has a unit cost of ${batch.unitCost}.`
            );
          }

          const actualUnitCost =
            Number(batch.unitCost);

          await increaseBatchStock(
            batch.id,
            destinationWarehouseId!,
            quantity
          );

          await increaseTotalStock(
            destinationWarehouseId!,
            quantity,
            actualUnitCost
          );

          return tx.inventoryMovement.create({
            data: {
              companyId,
              productId, 
              batchId: batch.id,
              destinationWarehouseId,
              type: "ADJUSTMENT_IN",
              referenceType: "ADJUSTMENT",
              quantity,
              unitCost: actualUnitCost,
              totalCost:
                quantity * actualUnitCost,
              movementDate,
              notes,
            },
            include: {
              product: true,
              batch: {
                include: { stockBatches: true },
              },
              destinationWarehouse: true,
            },
          });
        }

        /* ====================================================
           OPENING
           ==================================================== */

        if (movementType === "OPENING") {
          let batch = await getBatch();

          if (!batch) {
            batch =
              await createOpeningBatch(
                requestedUnitCost
              );
          } else if (
            requestedUnitCost > 0 &&
            Number(batch.unitCost) !==
              requestedUnitCost
          ) {
            throw new Error(
              `Batch ${batch.batchNumber} already has a different unit cost.`
            );
          }

          const actualUnitCost =
            Number(batch.unitCost);

          await increaseBatchStock(
            batch.id,
            destinationWarehouseId!,
            quantity
          );

          await increaseTotalStock(
            destinationWarehouseId!,
            quantity,
            actualUnitCost
          );

          return tx.inventoryMovement.create({
            data: {
              companyId,
              productId, 
              batchId: batch.id,
              destinationWarehouseId,
              type: "OPENING",
              referenceType: "OPENING",
              quantity,
              unitCost: actualUnitCost,
              totalCost:
                quantity * actualUnitCost,
              movementDate,
              notes,
            },
            include: {
              product: true,
              batch: {
                include: { stockBatches: true },
              },
              destinationWarehouse: true,
            },
          });
        }

        /* ====================================================
           ADJUSTMENT OUT
           ==================================================== */

        if (
          movementType ===
          "ADJUSTMENT_OUT"
        ) {
          const batch =
            await getBatch();

          if (!batch) {
            throw new Error(
              "A batch is required for an adjustment out."
            );
          }

          const batchStock =
            batch.stockBatches.find(
              (item) =>
                item.warehouseId ===
                sourceWarehouseId
            );

          if (!batchStock) {
            throw new Error(
              "Selected batch has no stock in the selected warehouse."
            );
          }

          const available =
            toNumber(batchStock.quantity);

          if (available < quantity) {
            throw new Error(
              `Insufficient batch stock. Available quantity is ${available}.`
            );
          }

          const actualUnitCost =
            Number(batch.unitCost);

          await decreaseBatchStock(
            batch.id,
            sourceWarehouseId!,
            quantity
          );

          await decreaseTotalStock(
            sourceWarehouseId!,
            quantity
          );

          return tx.inventoryMovement.create({
            data: {
              companyId,
              productId, 
              batchId: batch.id,
              sourceWarehouseId,
              type: "ADJUSTMENT_OUT",
              referenceType: "ADJUSTMENT",
              quantity,
              unitCost: actualUnitCost,
              totalCost:
                quantity * actualUnitCost,
              movementDate,
              notes,
            },
            include: {
              product: true,
              batch: {
                include: { stockBatches: true },
              },
              sourceWarehouse: true,
            },
          });
        }

        /* ====================================================
           TRANSFER
           ==================================================== */

        if (
          movementType ===
            "TRANSFER_IN" ||
          movementType ===
            "TRANSFER_OUT"
        ) {
          const batch =
            await getBatch();

          if (!batch) {
            throw new Error(
              "A batch is required for a warehouse transfer."
            );
          }

          const sourceBatchStock =
            batch.stockBatches.find(
              (item) =>
                item.warehouseId ===
                sourceWarehouseId
            );

          if (!sourceBatchStock) {
            throw new Error(
              "Selected batch has no stock in the source warehouse."
            );
          }

          const available =
            toNumber(
              sourceBatchStock.quantity
            );

          if (available < quantity) {
            throw new Error(
              `Insufficient batch stock for transfer. Available quantity is ${available}.`
            );
          }

          const transferUnitCost =
            Number(batch.unitCost);

          await decreaseBatchStock(
            batch.id,
            sourceWarehouseId!,
            quantity
          );

          await decreaseTotalStock(
            sourceWarehouseId!,
            quantity
          );

          await increaseBatchStock(
            batch.id,
            destinationWarehouseId!,
            quantity
          );

          await increaseTotalStock(
            destinationWarehouseId!,
            quantity,
            transferUnitCost
          );

          await tx.inventoryMovement.create({
            data: {
              companyId,
              productId, 
              batchId: batch.id,
              sourceWarehouseId,
              destinationWarehouseId,
              type: "TRANSFER_OUT",
              referenceType: "TRANSFER",
              quantity,
              unitCost:
                transferUnitCost,
              totalCost:
                quantity *
                transferUnitCost,
              movementDate,
              notes,
            },
          });

          return tx.inventoryMovement.create({
            data: {
              companyId,
              productId, 
              batchId: batch.id,
              sourceWarehouseId,
              destinationWarehouseId,
              type: "TRANSFER_IN",
              referenceType: "TRANSFER",
              quantity,
              unitCost:
                transferUnitCost,
              totalCost:
                quantity *
                transferUnitCost,
              movementDate,
              notes,
            },
            include: {
              product: true,
              batch: {
                include: { stockBatches: true },
              },
              sourceWarehouse: true,
              destinationWarehouse: true,
            },
          });
        }

        throw new Error(
          "Unsupported inventory movement type."
        );
      }
    );

    return NextResponse.json(
      {
        ok: true,
        movement: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "POST /api/inventory-movements error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to create inventory movement.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}








