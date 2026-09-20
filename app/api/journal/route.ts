import { NextResponse } from "next/server";
import { postFinancialTransaction } from "@/app/services/postingEngine";

export async function POST(request: Request) {
  // 1. Extract the isolated tenant ID injected by your middleware
  const tenantId = request.headers.get("x-tenant-id");
  
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context missing" }, { status: 400 });
  }

  try {
    const body = await request.json();
    
    // 2. Pass data to the centralized ACID engine
    const journalEntry = await postFinancialTransaction({
      tenantId,
      description: body.description,
      reference: body.reference,
      lines: body.lines
    });

    return NextResponse.json({ success: true, data: journalEntry });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}