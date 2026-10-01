import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { authenticate } from "@/app/lib/auth";
import type { Prisma } from "@/app/generated/prisma/client";
import fs from "fs";
import path from "path";
import { DEFAULT_ERP_SETTINGS } from "@/app/types/erp-settings";

type SalesLineInput = { productId: string; batchId: string; warehouseId: string; quantity: number; unitPrice: number; discount?: number; tax?: number; description?: string | null; };
type SalesInvoiceInput = { id?: string; customerId: string | null; courierId?: string | null; status?: "DRAFT" | "POSTED"; discount?: number; tax?: number; deliveryCharges?: number; notes?: string | null; lines: SalesLineInput[]; };

function decimalNumber(value: unknown): number { const n = Number(value ?? 0); return Number.isFinite(n) ? n : 0; }
function cleanString(value: unknown): string | null { if (value === undefined || value === null) return null; const r = String(value).trim(); return r.length > 0 ? r : null; }

function readGlobalSettings() {
  try {
    const fallbackPath = path.join(process.cwd(), "settings-data.json");
    if (fs.existsSync(fallbackPath)) {
      return JSON.parse(fs.readFileSync(fallbackPath, "utf8"));
    }
  } catch (e) {}
  return DEFAULT_ERP_SETTINGS;
}

async function getCompany() { return prisma.company.findFirst({ orderBy: { createdAt: "asc" } }); }

async function nextEntryNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const settings = readGlobalSettings();
  const prefix = settings.numbering?.journalPrefix || "JE-";
  
  const latest = await tx.journalEntry.findFirst({ 
    where: { companyId, entryNumber: { startsWith: prefix } }, 
    orderBy: { createdAt: "desc" } 
  });
  
  if (!latest || !latest.entryNumber) return `${prefix}000001`;
  const numPart = latest.entryNumber.substring(prefix.length);
  const nextNum = parseInt(numPart, 10) + 1;
  return `${prefix}${String(isNaN(nextNum) ? 1 : nextNum).padStart(6, "0")}`;
}

async function nextInvoiceNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const settings = readGlobalSettings();
  const prefix = settings.numbering?.invoicePrefix || "INV-";
  const startNum = settings.numbering?.nextInvoiceNumber || 1;

  const latest = await tx.salesInvoice.findFirst({ 
    where: { companyId, invoiceNo: { startsWith: prefix } }, 
    orderBy: { createdAt: "desc" } 
  });
  
  if (!latest || !latest.invoiceNo) return `${prefix}${String(startNum).padStart(6, "0")}`;
  const numPart = latest.invoiceNo.substring(prefix.length);
  const nextNum = parseInt(numPart, 10) + 1;
  return `${prefix}${String(isNaN(nextNum) ? startNum : nextNum).padStart(6, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const company = await getCompany();
    if (!company) return NextResponse.json({ ok: false, error: "No company configured." }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const search = cleanString(searchParams.get("search"));
    const tab = cleanString(searchParams.get("tab")) || "draft";
    const id = cleanString(searchParams.get("id"));

    if (id) {
      const invoice = await prisma.salesInvoice.findFirst({
        where: { id: id, companyId: company.id },
        include: { customer: true, lines: { include: { product: true, batch: true } } }
      });
      return NextResponse.json({ ok: true, invoices: invoice ? [invoice] : [] });
    }

    let whereClause: any = { companyId: company.id };
    
    if (tab === "draft") {
      whereClause.status = "DRAFT";
    } else if (tab === "web") {
      whereClause.notes = { contains: "Web Order", mode: "insensitive" };
    } else {
      whereClause.status = { in: ["POSTED", "PARTIAL", "PAID", "VOID"] };
    }

    if (search) {
      whereClause.OR = [
        { invoiceNo: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } }
      ];
    }

    const invoices = await prisma.salesInvoice.findMany({
      where: whereClause,
      include: { customer: true, lines: { include: { product: true, batch: true } } },
      orderBy: { invoiceDate: "desc" },
    });

    return NextResponse.json({ ok: true, invoices });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as SalesInvoiceInput;
    const company = await getCompany();
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const customerId = cleanString(body.customerId);
    let courierId = cleanString(body.courierId);
    const settings = readGlobalSettings();
    if (settings.sales?.requireCustomer && !customerId) return NextResponse.json({ ok: false, error: "Customer is required by system settings" }, { status: 400 });

    // --- SMART AUTO-EXTRACTION ---
    if (!courierId && body.notes) {
      const match = body.notes.match(/Courier:\s*([^|]+)/i);
      if (match && match[1]) {
        const foundCourier = await prisma.courier.findFirst({
          where: { companyId: company.id, name: { equals: match[1].trim(), mode: "insensitive" } }
        });
        if (foundCourier) courierId = foundCourier.id;
      }
    }

    const lines = body.lines.map(line => {
      const quantity = decimalNumber(line.quantity);
      const unitPrice = decimalNumber(line.unitPrice);
      const discount = decimalNumber(line.discount);
      const tax = decimalNumber(line.tax);
      return { ...line, quantity, unitPrice, discount, tax, total: (quantity * unitPrice) - discount + tax };
    });

    const lineSubtotal = lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice), 0);
    const lineDiscount = lines.reduce((sum, l) => sum + l.discount, 0);
    const lineTax = lines.reduce((sum, l) => sum + l.tax, 0);

    const totalDiscount = lineDiscount + decimalNumber(body.discount);
    const totalTax = lineTax + decimalNumber(body.tax);
    const deliveryCharges = decimalNumber(body.deliveryCharges);
    const total = lineSubtotal - totalDiscount + totalTax + deliveryCharges;

    const result = await prisma.$transaction(async (tx) => {
      const invoiceNo = await nextInvoiceNumber(tx, company.id);
      
      return await tx.salesInvoice.create({
        data: {
          companyId: company.id, customerId, courierId, invoiceNo,
          invoiceDate: new Date(), dueDate: null, status: "DRAFT",
          subtotal: lineSubtotal, discount: totalDiscount, tax: totalTax, deliveryCharges, total,
          paid: 0, balance: total, cogs: 0, notes: cleanString(body.notes),
          lines: {
            create: lines.map(l => ({
              productId: l.productId, batchId: cleanString(l.batchId), warehouseId: cleanString(l.warehouseId),
              quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount, tax: l.tax, total: l.total,
              cogsUnitCost: 0, cogsTotal: 0, description: cleanString(l.description)
            }))
          }
        },
        include: { lines: { include: { product: true, batch: true } } }
      });
    });

    if (body.status === "POSTED") {
      const companySettings = await prisma.companySettings.findUnique({ where: { companyId: company.id } });
      await postSingleInvoice(result, (companySettings?.accounting as any) ?? {}, company.id, companySettings);
    }

    return NextResponse.json({ ok: true, message: "Invoice created successfully" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as SalesInvoiceInput;
    if (!body.id) return NextResponse.json({ ok: false, error: "Invoice ID required" }, { status: 400 });

    const company = await getCompany();
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const existing = await prisma.salesInvoice.findUnique({ where: { id: body.id, companyId: company.id }, include: { lines: true, journal: { include: { lines: true } } } });
    if (!existing) return NextResponse.json({ ok: false, error: "Invoice not found" }, { status: 404 });

    if (existing.status !== "DRAFT") {
      if (Number(existing.paid) > 0) return NextResponse.json({ ok: false, error: "Cannot edit an invoice that has payments applied." }, { status: 403 });
      const isAdmin = user.role?.name?.toUpperCase() === "ADMINISTRATOR" || user.email === "admin@izan.com";
      const canEditPosted = user.role?.permissions?.some((p: any) => p.permission.action === "edit_posted_invoices");
      if (!isAdmin && !canEditPosted) return NextResponse.json({ ok: false, error: "Not authorized to edit finalized invoices." }, { status: 403 });
    }

    let extractedCourierId = cleanString(body.courierId);
    
    // --- SMART AUTO-EXTRACTION ---
    if (!extractedCourierId && body.notes) {
      const match = body.notes.match(/Courier:\s*([^|]+)/i);
      if (match && match[1]) {
        const foundCourier = await prisma.courier.findFirst({
          where: { companyId: company.id, name: { equals: match[1].trim(), mode: "insensitive" } }
        });
        if (foundCourier) extractedCourierId = foundCourier.id;
      }
    }

    const finalCourierId = extractedCourierId !== null ? extractedCourierId : existing.courierId;

    const lines = body.lines.map(line => {
      const quantity = decimalNumber(line.quantity);
      const unitPrice = decimalNumber(line.unitPrice);
      const discount = decimalNumber(line.discount);
      const tax = decimalNumber(line.tax);
      return { ...line, quantity, unitPrice, discount, tax, total: (quantity * unitPrice) - discount + tax };
    });

    const lineSubtotal = lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice), 0);
    const totalDiscount = lines.reduce((sum, l) => sum + l.discount, 0) + decimalNumber(body.discount);
    const totalTax = lines.reduce((sum, l) => sum + l.tax, 0) + decimalNumber(body.tax);
    const deliveryCharges = decimalNumber(body.deliveryCharges);
    const total = lineSubtotal - totalDiscount + totalTax + deliveryCharges;

    const result = await prisma.$transaction(async (tx) => {
      if (existing.status !== "DRAFT") {
        for (const oldLine of existing.lines) {
          if(oldLine.batchId && oldLine.warehouseId) {
            await tx.stockBatch.updateMany({ where: { batchId: oldLine.batchId, warehouseId: oldLine.warehouseId }, data: { quantity: { increment: oldLine.quantity } } });
            await tx.stock.updateMany({ where: { productId: oldLine.productId, warehouseId: oldLine.warehouseId }, data: { quantity: { increment: oldLine.quantity } } });
            await tx.inventoryMovement.create({ data: { companyId: company.id, productId: oldLine.productId, batchId: oldLine.batchId, sourceWarehouseId: oldLine.warehouseId, type: "SALE", referenceType: "SALE", referenceId: existing.id, quantity: -Number(oldLine.quantity), unitCost: Number(oldLine.cogsUnitCost), totalCost: -Number(oldLine.quantity) * Number(oldLine.cogsUnitCost), movementDate: new Date(), notes: `Reversal Edit for ${existing.invoiceNo}` } });
          }
        }
        if (existing.journal) {
          const revLines = existing.journal.lines.map(l => ({ accountId: l.accountId, description: `Reversal - ${l.description}`, debit: Number(l.credit), credit: Number(l.debit) }));
          const eNum = await nextEntryNumber(tx, company.id);
          await tx.journalEntry.create({ data: { companyId: company.id, entryNumber: eNum, entryDate: new Date(), reference: `REV-${existing.invoiceNo}`, description: `Edit Reversal for ${existing.invoiceNo}`, status: "POSTED", referenceType: "SALE", lines: { create: revLines } } });
        }
      }

      await tx.salesInvoiceLine.deleteMany({ where: { invoiceId: existing.id } });
      
      const updatedInv = await tx.salesInvoice.update({
        where: { id: existing.id },
        data: {
          customerId: body.customerId || null,
          courierId: finalCourierId,
          subtotal: lineSubtotal, discount: totalDiscount, tax: totalTax, deliveryCharges, total, balance: total, notes: cleanString(body.notes),
          status: "DRAFT",
          lines: {
            create: lines.map(l => ({
              productId: l.productId, batchId: cleanString(l.batchId), warehouseId: cleanString(l.warehouseId),
              quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount, tax: l.tax, total: l.total,
              cogsUnitCost: 0, cogsTotal: 0, description: cleanString(l.description)
            }))
          }
        },
        include: { lines: { include: { product: true, batch: true } } }
      });
      return updatedInv;
    });

    if (body.status === "POSTED" || existing.status !== "DRAFT") {
      const companySettings = await prisma.companySettings.findUnique({ where: { companyId: company.id } });
      await postSingleInvoice(result, (companySettings?.accounting as any) ?? {}, company.id, companySettings);
    }

    return NextResponse.json({ ok: true, message: "Invoice updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const action = cleanString(body.action);
    const company = await getCompany();
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    if (action === "BULK_POST") {
      const ids = body.ids as string[];
      if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ ok: false, error: "No invoices selected" }, { status: 400 });

      const companySettings = await prisma.companySettings.findUnique({ where: { companyId: company.id } });
      const acc = (companySettings?.accounting as any) ?? {};

      let postedCount = 0;
      for (const id of ids) {
        const inv = await prisma.salesInvoice.findUnique({ where: { id }, include: { lines: { include: { product: true, batch: true } } } });
        if (inv && inv.status === "DRAFT") {
          await postSingleInvoice(inv, acc, company.id, companySettings);
          postedCount++;
        }
      }
      return NextResponse.json({ ok: true, message: `Successfully posted ${postedCount} invoices.` });
    }
    return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

async function postSingleInvoice(inv: any, acc: any, companyId: string, companySettings: any) {
  const salesSettings = (companySettings?.sales as any) ?? {};
  const isCourier = !!inv.courierId;
  const taxSettings = acc.tax || {};
  
  // DYNAMIC LEDGER ROUTING (Checks both names and blocks)
  const courierCollection = salesSettings.courierCollectionAccount || salesSettings.courierCollectionAccountId || acc.courierCollectionAccount || acc.courierCollectionAccountId;
  const deliveryIncome = salesSettings.deliveryIncomeAccount || salesSettings.deliveryIncomeAccountId || acc.deliveryIncomeAccount || acc.deliveryIncomeAccountId || acc.deliveryAccountId;
  const courierPayable = salesSettings.courierPayableAccount || salesSettings.courierPayableAccountId || acc.courierPayableAccount || acc.courierPayableAccountId;
  const deliveryExpense = salesSettings.deliveryExpenseAccount || salesSettings.deliveryExpenseAccountId || acc.deliveryExpenseAccount || acc.deliveryExpenseAccountId;

  const arAccountId = isCourier ? courierCollection : (acc.arAccountId || acc.accountsReceivableAccountId);
  const discountAccountId = acc.discountAccountId;
  const deliveryAccountId = isCourier ? deliveryIncome : acc.deliveryAccountId;
  const taxAccountId = taxSettings.taxPayableAccountId || acc.taxPayableAccountId;

  const missing = [];
  if (!arAccountId) missing.push(isCourier ? "Courier Collection Account (Settings)" : "Accounts Receivable");
  if (Number(inv.discount) > 0 && !discountAccountId) missing.push("Discount Allowed Expense");
  if (Number(inv.deliveryCharges) > 0 && !deliveryAccountId) missing.push(isCourier ? "Delivery Income Account (Settings)" : "Delivery Charges Revenue");
  if (Number(inv.tax) > 0 && !taxAccountId) missing.push("Tax Payable");
  
  if (isCourier && Number(inv.deliveryCharges) > 0) {
    if (!courierPayable) missing.push("Courier Payable Account (Settings)");
    if (!deliveryExpense) missing.push("Delivery Expense Account (Settings)");
  }

  for (const line of inv.lines) {
    if (!line.product.salesAccountId && !acc.defaultSalesAccountId) missing.push(`Sales Account for ${line.product.name}`);
    if (!line.product.cogsAccountId && !acc.defaultCogsAccountId) missing.push(`COGS Account for ${line.product.name}`);
    if (!line.product.inventoryAccountId && !acc.defaultInventoryAccountId) missing.push(`Inventory Asset for ${line.product.name}`);
  }

  if (missing.length > 0) throw new Error(`Missing GL Mappings: ${missing.join(", ")}`);

  return await prisma.$transaction(async (tx) => {
    let totalCogs = 0;
    const jLines = [];

    for (const line of inv.lines) {
      if(line.batchId && line.warehouseId) {
        const stockBatch = await tx.stockBatch.findUnique({ where: { batchId_warehouseId: { batchId: line.batchId, warehouseId: line.warehouseId } } });
        const available = stockBatch ? Number(stockBatch.quantity) : 0;
        if (available < Number(line.quantity)) throw new Error(`Insufficient stock for ${line.product.name}`);

        const cogsUnit = Number(line.batch?.unitCost || 0);
        const cogsTot = Number(line.quantity) * cogsUnit;
        totalCogs += cogsTot;

        await tx.stockBatch.updateMany({ where: { batchId: line.batchId, warehouseId: line.warehouseId }, data: { quantity: { decrement: line.quantity } } });
        await tx.stock.updateMany({ where: { productId: line.productId, warehouseId: line.warehouseId }, data: { quantity: { decrement: line.quantity } } });
        await tx.inventoryMovement.create({ data: { companyId, productId: line.productId, batchId: line.batchId, sourceWarehouseId: line.warehouseId, type: "SALE", referenceType: "SALE", referenceId: inv.id, quantity: line.quantity, unitCost: cogsUnit, totalCost: cogsTot, movementDate: new Date(), notes: `Sales Invoice ${inv.invoiceNo}` } });
        
        await tx.salesInvoiceLine.update({ where: { id: line.id }, data: { cogsUnitCost: cogsUnit, cogsTotal: cogsTot } });
      }

      const salesAcc = line.product.salesAccountId || acc.defaultSalesAccountId;
      const cogsAcc = line.product.cogsAccountId || acc.defaultCogsAccountId;
      const invAcc = line.product.inventoryAccountId || acc.defaultInventoryAccountId;
      const grossRevenue = Number(line.quantity) * Number(line.unitPrice);

      jLines.push({ accountId: cogsAcc, debit: 0, credit: 0, description: `COGS - ${line.product.name}` }); 
      jLines.push({ accountId: invAcc, debit: 0, credit: 0, description: `Inventory - ${line.product.name}` }); 
      jLines.push({ accountId: salesAcc, debit: 0, credit: grossRevenue, description: `Sales - ${line.product.name}` });
    }

    if (Number(inv.discount) > 0) jLines.push({ accountId: discountAccountId, debit: Number(inv.discount), credit: 0, description: "Discount Allowed" });
    
    if (Number(inv.deliveryCharges) > 0) {
      jLines.push({ accountId: deliveryAccountId, debit: 0, credit: Number(inv.deliveryCharges), description: isCourier ? "Delivery Revenue (Courier)" : "Delivery Charges" });
      
      if (isCourier) {
        jLines.push({ accountId: deliveryExpense, debit: Number(inv.deliveryCharges), credit: 0, description: `Courier Expense - ${inv.invoiceNo}` });
        jLines.push({ accountId: courierPayable, debit: 0, credit: Number(inv.deliveryCharges), description: `Courier Payable - ${inv.invoiceNo}` });
      }
    }
    
    if (Number(inv.tax) > 0) jLines.push({ accountId: taxAccountId, debit: 0, credit: Number(inv.tax), description: "Sales Tax Collected" });
    jLines.push({ accountId: arAccountId, debit: Number(inv.total), credit: 0, description: `${isCourier ? 'Courier Collection' : 'AR'} - Invoice ${inv.invoiceNo}` });

    const entryNumber = await nextEntryNumber(tx, companyId);
    const je = await tx.journalEntry.create({
      data: {
        companyId, entryNumber, entryDate: new Date(), reference: inv.invoiceNo, status: "POSTED", referenceType: "SALE",
        description: `Sales Invoice ${inv.invoiceNo}`, lines: { create: jLines }
      }
    });

    return tx.salesInvoice.update({ where: { id: inv.id }, data: { status: "POSTED", cogs: totalCogs, journalId: je.id } });
  });
}