import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import * as xlsx from "xlsx";

export async function POST(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ ok: false, error: "No file uploaded." }, { status: 400 });
    }

    // Read file buffer and parse with xlsx
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = xlsx.read(buffer, { type: "buffer" });
    
    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const rows = xlsx.utils.sheet_to_json(worksheet) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "The uploaded file is empty." }, { status: 400 });
    }

    let importedCount = 0;

    // Process and upsert each account
    for (const row of rows) {
      // Try to match common column names users might use in Excel
      const code = String(row["Account Code"] || row["Code"] || row["code"] || "").trim();
      const name = String(row["Account Name"] || row["Name"] || row["name"] || "").trim();
      const rawType = String(row["Account Type"] || row["Type"] || row["type"] || "ASSET").trim().toUpperCase();
      
      if (!code || !name) continue; // Skip invalid rows

      // Ensure valid Prisma Enum Type (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)
      const validTypes = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];
      const type = (validTypes.includes(rawType) ? rawType : "ASSET") as "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

      await prisma.account.upsert({
        where: { 
          companyId_code: { companyId: company.id, code: code } 
        },
        update: {
          name,
          type,
          isActive: true
        },
        create: {
          companyId: company.id,
          code,
          name,
          type,
          isActive: true
        }
      });
      importedCount++;
    }

    return NextResponse.json({ 
      ok: true, 
      message: `Successfully imported or updated ${importedCount} accounts.` 
    });

  } catch (error) {
    console.error("POST /api/accounting/accounts/import error:", error);
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : "Failed to import file." 
    }, { status: 500 });
  }
}