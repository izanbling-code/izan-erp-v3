import { prisma } from "@/app/lib/prisma";
﻿import { NextResponse } from "next/server";


export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    
    const customers = await prisma.customer.findMany({
      where: { 
        OR: [ 
          { name: { contains: query, mode: "insensitive" } }, 
          { phone: { contains: query } } 
        ] 
      },
      take: 5
    });
    
    return NextResponse.json({ customers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
