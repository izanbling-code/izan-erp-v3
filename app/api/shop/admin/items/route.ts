import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    // Fetches all active products to display on the storefront
    const products = await prisma.product.findMany({
      where: { isActive: true, type: "GOODS" },
      select: {
        id: true,
        name: true,
        sku: true,
        salePrice: true,
        imageUrl: true,
      }
    });
    
    // Map the database fields to match the UI component's expectations
    const formattedProducts = products.map(p => ({
      id: p.id,
      name: p.name,
      price: Number(p.salePrice),
      image: p.imageUrl || "https://placehold.co/400x500/f3f4f6/a1a1aa?text=No+Image"
    }));

    return NextResponse.json(formattedProducts);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json([], { status: 500 });
  }
}
