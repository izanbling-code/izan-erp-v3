import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    // Fetch active products, their warehouse stocks, and their inventory batches
    const products = await prisma.product.findMany({
      where: {
       isActive: true,
       type: { in: ["PRODUCT","SERVICE","GOODS"] } // <-- To this
       },
      select: {
        id: true,
        name: true,
        sku: true,
        salePrice: true,
        imageUrl: true,
        stocks: {
          select: {
            quantity: true
          }
        },
        batches: {
          select: {
            originalQuantity: true,
            stock: {
              select: {
                quantity: true
              }
            }
          }
        }
      }
    });
    
    // Calculate available stock robustly (Warehouse stock OR fallback to batch quantities)
    const availableProducts = products
      .map(p => {
        // 1. Try summing warehouse-level stock
        let totalStock = p.stocks.reduce((sum, stock) => sum + Number(stock.quantity || 0), 0);
        
        // 2. Fallback: If warehouse stock table is empty, sum up from batches directly
        if (totalStock === 0 && p.batches && p.batches.length > 0) {
          totalStock = p.batches.reduce((batchSum, batch) => {
            const batchQty = batch.stock.reduce((sSum, s) => sSum + Number(s.quantity || 0), 0);
            return batchSum + (batchQty > 0 ? batchQty : Number(batch.originalQuantity || 0));
          }, 0);
        }
        
        return {
          id: p.id,
          name: p.name,
          price: Number(p.salePrice),
          image: p.imageUrl || "https://placehold.co/400x500/f3f4f6/a1a1aa?text=No+Image",
          stockAvailable: totalStock
        };
      })
      // Only show items that have actual available stock
      .filter(p => p.stockAvailable > 0);

    return NextResponse.json(availableProducts);
  } catch (error) {
    console.error("Failed to fetch shop products:", error);
    return NextResponse.json([], { status: 500 });
  }
}