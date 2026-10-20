import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        type: { in: ["PRODUCT", "SERVICE", "GOODS"] },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        salePrice: true,
        imageUrl: true,
        stocks: {
          select: {
            quantity: true,
          },
        },
      },
    });

    const availableProducts = products
      .map((p) => {
        const totalStock = p.stocks.reduce((sum: number, stock) => sum + Number(stock.quantity || 0), 0);
        return {
          id: p.id,
          name: p.name,
          price: Number(p.salePrice),
          image: p.imageUrl || "https://placehold.co/400x500/f3f4f6/a1a1aa?text=No+Image",
          stockAvailable: totalStock,
        };
      })
      .filter((p) => p.stockAvailable > 0);

    return NextResponse.json(availableProducts);
  } catch (error) {
    console.error("Failed to fetch shop products:", error);
    return NextResponse.json([], { status: 500 });
  }
}