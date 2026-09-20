import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

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
          error: "No company has been configured yet",
        },
        { status: 400 }
      );
    }

    const [stock, warehouses, products, stockBatches] = await Promise.all([
      prisma.stock.findMany({
        where: {
          product: {
            companyId: company.id,
          },
        },
        include: {
          product: {
            include: {
              category: true,
              brand: true,
              unit: true,
            },
          },
          warehouse: true,
        },
        orderBy: [
          {
            warehouse: {
              name: "asc",
            },
          },
          {
            product: {
              name: "asc",
            },
          },
        ],
      }),

      prisma.warehouse.findMany({
        where: {
          companyId: company.id,
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
      }),

      prisma.product.findMany({
        where: {
          companyId: company.id,
          isActive: true,
        },
        include: {
          category: true,
          brand: true,
          unit: true,
        },
        orderBy: {
          name: "asc",
        },
      }),

      /*
       * ------------------------------------------------------
       * BATCH-LEVEL STOCK
       * ------------------------------------------------------
       *
       * Sales invoice lines must reference a specific
       * InventoryBatch (one cost layer). This gives the
       * frontend everything it needs to build a batch picker:
       * which batches are sitting in which warehouse, how much
       * quantity remains, and what that batch's unit cost is
       * (used to snapshot COGS at the time of sale).
       *
       * Only batches with remaining quantity are returned,
       * since a depleted batch can't be sold from.
       */
      prisma.stockBatch.findMany({
        where: {
          product: {
            companyId: company.id,
          },
          quantity: {
            gt: 0,
          },
        },
        include: {
          batch: true,
        },
        orderBy: [
          {
            batch: {
              purchaseDate: "asc",
            },
          },
        ],
      }),
    ]);

    return NextResponse.json({
      ok: true,
      stock,
      warehouses,
      products,
      stockBatches,
    });
  } catch (error) {
    console.error("GET /api/stock error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load stock",
      },
      { status: 500 }
    );
  }
}