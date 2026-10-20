import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { authenticate } from "@/app/lib/auth";

async function getCompany() { return prisma.company.findFirst({ orderBy: { createdAt: "asc" } }); }

async function generateVoucherNumber(tx: any, companyId: string, prefix: string, model: "expenseVoucher" | "supplierPayment") {
  const latest = await tx[model].findFirst({
    where: { companyId, [model === "expenseVoucher" ? "voucherNumber" : "paymentNumber"]: { startsWith: prefix } },
    orderBy: { createdAt: "desc" }
  });
  const currentNo = latest ? (latest.voucherNumber || latest.paymentNumber) : null;
  const match = currentNo?.match(new RegExp(`${prefix}(\\d+)`));
  if (!match) return `${prefix}000001`;
  return `${prefix}${String(Number(match[1]) + 1).padStart(6, "0")}`;
}

async function nextEntryNumber(tx: any, companyId: string) {
  const latest = await tx.journalEntry.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" }, select: { entryNumber: true } });
  const match = latest?.entryNumber?.match(/(\d+)$/);
  if (!match) return "JE-000001";
  return `JE-${String(Number(match[1]) + 1).padStart(6, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await authenticate(request);
    if (!authUser) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const company = await getCompany();
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const [expenses, payments, accounts, suppliers] = await Promise.all([
      prisma.expenseVoucher.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "desc" } }),
      prisma.supplierPayment.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "desc" } }),
      prisma.account.findMany({ where: { companyId: company.id, isActive: true }, select: { id: true, name: true, type: true, code: true }, orderBy: { name: "asc" } }),
      prisma.supplier.findMany({ where: { companyId: company.id }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    ]);

    return NextResponse.json({ ok: true, expenses, payments, accounts, suppliers });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await authenticate(request);
    if (!authUser) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const company = await getCompany();
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      if (body.action === "CREATE_EXPENSE") {
        const voucherNumber = await generateVoucherNumber(tx, company.id, "EXP-", "expenseVoucher");
        return await tx.expenseVoucher.create({
          data: {
            companyId: company.id, voucherNumber, date: new Date(body.date), amount: Number(body.amount),
            accountId: body.accountId, paymentMethod: body.paymentMethod || null, paymentAccountId: body.paymentAccountId || null,
            status: "DRAFT", notes: body.notes || null, referenceNo: body.referenceNo || null, expenseType: "DIRECT_PAYMENT"
          }
        });
      } 
      else if (body.action === "CREATE_PAYMENT") {
        const paymentNumber = await generateVoucherNumber(tx, company.id, "PAY-", "supplierPayment");
        return await tx.supplierPayment.create({
          data: {
            companyId: company.id, paymentNumber, supplierId: body.supplierId, date: new Date(body.date), amount: Number(body.amount),
            method: body.method, accountId: body.accountId, status: "DRAFT", notes: body.notes || null, referenceNo: body.referenceNo || null, isAdvance: body.isAdvance || false
          }
        });
      }
      throw new Error("Invalid action payload");
    });

    return NextResponse.json({ ok: true, message: "Record created successfully", data: result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authUser = await authenticate(request);
    if (!authUser) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    
    // Permission check for approvals
    if (["APPROVED", "REJECTED", "POSTED"].includes(body.status)) {
       const isAdmin = authUser.role?.name?.toUpperCase() === "ADMINISTRATOR" || authUser.email === "admin@izan.com";
       const canApprove = authUser.role?.permissions?.some((p: any) => p.permission.action === "approve_payables");
       if (!isAdmin && !canApprove) return NextResponse.json({ ok: false, error: "You do not have permission to approve or post payables." }, { status: 403 });
    }

    const result = await prisma.$transaction(async (tx) => {
      let record;
      if (body.type === "EXPENSE") {
        // Safe fetch without unmapped includes
        record = await tx.expenseVoucher.findUnique({ where: { id: body.id } });
        if (!record) throw new Error("Expense not found");

        if (body.status === "POSTED") {
          if (!record.paymentAccountId) throw new Error("Payment Account must be selected to post");
          
          // Manual lookup for Description
          const expAccount = await tx.account.findUnique({ where: { id: record.accountId } });
          const desc = `Direct Expense: ${expAccount?.name || ""} ${record.notes ? "- " + record.notes : ""} ${record.referenceNo ? "(Ref: " + record.referenceNo + ")" : ""}`.trim();
          
          const eNum = await nextEntryNumber(tx, record.companyId);
          const je = await tx.journalEntry.create({
            data: {
              companyId: record.companyId, entryNumber: eNum, entryDate: new Date(), status: "POSTED", reference: record.voucherNumber, referenceType: "EXPENSE", 
              description: desc,
              lines: { create: [
                { accountId: record.accountId, debit: record.amount, credit: 0, description: "Expense Incurred" },
                { accountId: record.paymentAccountId, debit: 0, credit: record.amount, description: "Payment Disbursed" }
              ]}
            }
          });

          const sourceBank = await tx.bankAccount.findFirst({ where: { glAccountId: record.paymentAccountId } });
          if (sourceBank) {
            await tx.bankTransaction.create({
              data: {
                companyId: record.companyId, bankAccountId: sourceBank.id, transactionDate: new Date(),
                reference: record.voucherNumber, description: desc, instrumentType: record.paymentMethod === "CHECK" ? "CHECK" : "ONLINE_TRANSFER",
                moneyIn: 0, moneyOut: record.amount, status: "CLEARED"
              }
            });
          }

          return await tx.expenseVoucher.update({ where: { id: body.id }, data: { status: body.status, journalId: je.id } });
        }
        return await tx.expenseVoucher.update({ where: { id: body.id }, data: { status: body.status } });
      } 
      else if (body.type === "PAYMENT") {
        // Safe fetch without unmapped includes
        record = await tx.supplierPayment.findUnique({ where: { id: body.id } });
        if (!record) throw new Error("Payment not found");
        
        if (body.status === "POSTED") {
          const settings = await tx.companySettings.findUnique({ where: { companyId: record.companyId } });
          const apAccountId = (settings?.accounting as any)?.accountsPayableAccountId;
          if (!apAccountId) throw new Error("Accounts Payable GL account is not configured in Settings.");

          // Manual lookup for Description
          const supp = record.supplierId ? await tx.supplier.findUnique({ where: { id: record.supplierId } }) : null;
          const desc = `Payment to ${supp?.name || "Supplier"} ${record.notes ? "- " + record.notes : ""} ${record.referenceNo ? "(Ref: " + record.referenceNo + ")" : ""}`.trim();

          const eNum = await nextEntryNumber(tx, record.companyId);
          const je = await tx.journalEntry.create({
            data: {
              companyId: record.companyId, entryNumber: eNum, entryDate: new Date(), status: "POSTED", reference: record.paymentNumber, referenceType: "PURCHASE", 
              description: desc,
              lines: { create: [
                { accountId: apAccountId, debit: record.amount, credit: 0, description: "AP Settlement" },
                { accountId: record.accountId, debit: 0, credit: record.amount, description: "Funds Disbursed" }
              ]}
            }
          });

          const sourceBank = await tx.bankAccount.findFirst({ where: { glAccountId: record.accountId } });
          if (sourceBank) {
            await tx.bankTransaction.create({
              data: {
                companyId: record.companyId, bankAccountId: sourceBank.id, transactionDate: new Date(),
                reference: record.paymentNumber, description: desc, instrumentType: record.method === "CHECK" ? "CHECK" : "ONLINE_TRANSFER",
                moneyIn: 0, moneyOut: record.amount, status: "CLEARED"
              }
            });
          }

          return await tx.supplierPayment.update({ where: { id: body.id }, data: { status: body.status, journalId: je.id } });
        }
        return await tx.supplierPayment.update({ where: { id: body.id }, data: { status: body.status } });
      }
    });

    return NextResponse.json({ ok: true, message: `Status updated to ${body.status}` });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}