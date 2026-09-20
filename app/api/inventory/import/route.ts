import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import * as xlsx from "xlsx";

export async function GET(req: NextRequest) {
  const worksheet = xlsx.utils.json_to_sheet([
    { "Product Name": "Premium Gold Claw Clip", "SKU": "CLAW-GLD-01", "Product Type": "PRODUCT", "Category": "Hair Accessories", "Brand": "Izan Bling", "Units": "PCS", "Cost Price": 150, "Sale Price": 450 },
    { "Product Name": "18k Snake Chain", "SKU": "NECK-SNK-18", "Product Type": "PRODUCT", "Category": "Stainless Steel", "Brand": "Izan Bling", "Units": "PCS", "Cost Price": 800, "Sale Price": 2500 }
  ]);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Products");
  const excelBuffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(excelBuffer, {
    headers: {
      "Content-Disposition": `attachment; filename="IzanBling_Product_Import_Template.xlsx"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // STEP 1: PARSE THE EXCEL FILE
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });

      let headers: string[] = [];
      if (rows.length > 0) {
        headers = Object.keys(rows[0]);
      } else {
        const range = xlsx.utils.decode_range(sheet["!ref"] || "A1:A1");
        for(let C = range.s.c; C <= range.e.c; ++C) {
          const cell = sheet[xlsx.utils.encode_cell({c:C, r:range.s.r})];
          if(cell && cell.t) headers.push(xlsx.utils.format_cell(cell));
        }
      }

      return NextResponse.json({ ok: true, headers, rows });
    }

    // STEP 2: PROCESS THE MAPPED DATA
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const { products } = body;
      if (!products || !Array.isArray(products)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

      const company = await prisma.company.findFirst();
      if (!company) throw new Error("Company not found.");

      const companySettings = await prisma.companySettings.findUnique({ where: { companyId: company.id } });
      const defaults = (companySettings?.accounting as any) || {};

      let importedCount = 0;

      for (const row of products) {
        if (!row.name || !row.sku) continue;

        let categoryId = null, brandId = null, unitId = null;

        if (row.category) {
          const cat = await prisma.category.upsert({
            where: { companyId_name: { companyId: company.id, name: String(row.category).trim() } },
            update: {}, create: { companyId: company.id, name: String(row.category).trim() }
          });
          categoryId = cat.id;
        }

        if (row.brand) {
          const brd = await prisma.brand.upsert({
            where: { companyId_name: { companyId: company.id, name: String(row.brand).trim() } },
            update: {}, create: { companyId: company.id, name: String(row.brand).trim() }
          });
          brandId = brd.id;
        }

        if (row.unit) {
          const u = await prisma.unit.upsert({
            where: { companyId_name: { companyId: company.id, name: String(row.unit).trim() } },
            update: {}, create: { companyId: company.id, name: String(row.unit).trim(), abbreviation: String(row.unit).trim().slice(0, 10).toUpperCase() }
          });
          unitId = u.id;
        }

        const type = String(row.type).toUpperCase() === "SERVICE" ? "SERVICE" : "PRODUCT";

        await prisma.product.upsert({
          where: { companyId_sku: { companyId: company.id, sku: String(row.sku).trim() } },
          update: {
            name: String(row.name).trim(),
            type, categoryId, brandId, unitId,
            costPrice: Number(row.costPrice) || 0,
            salePrice: Number(row.salePrice) || 0,
            useDefaultAccounts: true,
            salesAccountId: defaults.defaultSalesAccountId || null,
            inventoryAccountId: defaults.defaultInventoryAccountId || null,
            cogsAccountId: defaults.defaultCogsAccountId || null,
            purchaseAccountId: defaults.defaultPurchaseAccountId || null,
          },
          create: {
            companyId: company.id,
            name: String(row.name).trim(),
            sku: String(row.sku).trim(),
            type, categoryId, brandId, unitId,
            costPrice: Number(row.costPrice) || 0,
            salePrice: Number(row.salePrice) || 0,
            useDefaultAccounts: true,
            salesAccountId: defaults.defaultSalesAccountId || null,
            inventoryAccountId: defaults.defaultInventoryAccountId || null,
            cogsAccountId: defaults.defaultCogsAccountId || null,
            purchaseAccountId: defaults.defaultPurchaseAccountId || null,
          }
        });
        importedCount++;
      }

      return NextResponse.json({ ok: true, message: `Success! Imported ${importedCount} products.` });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: any) {
    console.error("Import Error:", error);
    return NextResponse.json({ error: "Failed to process import." }, { status: 500 });
  }
}