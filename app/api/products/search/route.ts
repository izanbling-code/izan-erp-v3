export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma"; // Changed to named import

export async function GET(req: Request) {
  try {
    const products = await prisma.product.findMany({ take: 20 });
    return NextResponse.json({ products });
  } catch (error: any) {
    console.error("Prisma Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}