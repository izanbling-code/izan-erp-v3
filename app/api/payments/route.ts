import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

type AccountingSettings = { arAccountId?: string; accountsReceivableAccountId?: string; apAccountId?: string; accountsPayableAccountId?: string; };

async function getCompany() { return prisma.company.findFirst({ orderBy: { createdAt: "asc" } }); }

async function nextVoucherNumber(tx: Prisma.TransactionClient, companyId: string, prefix: string): Promise<string> {
  const latest = await tx.journalEntry.findFirst({
    where: { companyId, entryNumber: { startsWith: prefix } },
    orderBy: { entryNumber: "desc" }, select: { entryNumber: true },
  });
  if (!latest || !latest.entryNumber) return `${prefix}0001`;
  const parts = latest.entryNumber.split('-');
  return `${prefix}${String(parseInt(parts[parts.length - 1], 10) + 1).padStart(4, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const company = await getCompany();
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    const [allAssetAccounts, expenseAccounts, suppliers, customers, bills, invoices, payments] = await Promise.all([
      prisma.account.findMany({ where: { companyId: company.id, type: "ASSET", isActive: true }, select: { id: true, code: true, name: true, systemCode: true }, orderBy: { code: "asc" } }),
      prisma.account.findMany({ where: { companyId: company.id, type: "EXPENSE", isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
      prisma.supplier.findMany({ where: { companyId: company.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.customer.findMany({ where: { companyId: company.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.purchaseBill.findMany({ where: { companyId: company.id, status: { in: ["POSTED", "PARTIAL"] } }, include: { supplier: true }, orderBy: { billDate: "desc" } }),
      prisma.salesInvoice.findMany({ where: { companyId: company.id, status: { in: ["POSTED", "PARTIAL"] } }, include: { customer: true }, orderBy: { invoiceDate: "desc" } }),
      prisma.payment.findMany({
        where: { companyId: company.id, ...(mode === "supplier" ? { supplierId: { not: null } } : {}), ...(mode === "receive" ? { customerId: { not: null } } : {}) },
        // TS FIX: Removed explicit journal relation mapping
        include: { account: true, customer: true, supplier: true, salesAllocations: { include: { invoice: true } }, purchaseAllocations: { include: { bill: true } } },
        orderBy: { paymentDate: "desc" },
      }),
    ]);

    const paymentAccounts = allAssetAccounts.filter((acc) => {
      const name = acc.name.toLowerCase(); const code = acc.code;
      if (name.includes("receivable") || name.includes("inventory") || name.includes("stock") || name.includes("equipment") || name.includes("furniture") || name.includes("vehicle") || name.includes("building") || name.includes("depreciation") || name.includes("prepaid") || name.includes("accumulated")) return false;
      return (acc.systemCode === "BANK" || acc.systemCode === "CASH" || name.includes("cash") || name.includes("bank") || name.includes("meezan") || name.includes("easypaisa") || name.includes("jazzcash") || name.includes("nayapay") || name.includes("sadapay") || name.includes("wallet") || name.includes("petty") || code.startsWith("10") || code.startsWith("11"));
    });

    const formattedBills = bills.map((b) => ({ id: b.id, billNo: b.billNo, supplierId: b.supplierId, supplierName: b.supplier.name, total: Number(b.total), paid: Number(b.paid), balance: Number(b.balance), billDate: b.billDate }));
    const formattedInvoices = invoices.map((inv) => ({ id: inv.id, invoiceNo: inv.invoiceNo, customerId: inv.customerId, customerName: inv.customer.name, total: Number(inv.total), paid: Number(inv.paid), balance: Number(inv.balance), invoiceDate: inv.invoiceDate }));
    
    // TS FIX: Fetch Journal Entries safely in a secondary lookup map
    const validJournalIds = payments.map((p: any) => p.journalId).filter(Boolean);
    const journals = await prisma.journalEntry.findMany({
      where: { id: { in: validJournalIds } },
      select: { id: true, status: true, entryNumber: true }
    });
    const journalMap = new Map(journals.map(j => [j.id, j]));

    const formattedPayments = payments.map((p: any) => {
      let allocation = null;
      if (p.salesAllocations?.[0]) allocation = { invoiceId: p.salesAllocations[0].invoiceId, invoiceNo: p.salesAllocations[0].invoice?.invoiceNo, amount: Number(p.salesAllocations[0].amount) };
      else if (p.purchaseAllocations?.[0]) allocation = { billId: p.purchaseAllocations[0].billId, billNo: p.purchaseAllocations[0].bill?.billNo, amount: Number(p.purchaseAllocations[0].amount) };

      // Look up the draft status safely
      const j = p.journalId ? journalMap.get(p.journalId) : null;

      return {
        id: p.id, mode: p.customerId ? "receive" : p.supplierId ? "supplier" : "expense", paymentNo: p.paymentNo, paymentDate: p.paymentDate, method: p.method,
        amount: Number(p.amount), reference: p.reference, description: p.description,
        supplierId: p.supplierId, supplierName: p.supplier?.name || null, customerId: p.customerId, customerName: p.customer?.name || null,
        accountId: p.accountId, accountName: p.account?.name || null, expenseAccountId: p.expenseAccountId || null, expenseAccountName: null,
        status: j?.status === "DRAFT" ? "UNAPPROVED" : (p.journalId ? "POSTED" : "UNPOSTED"), voucherNo: j?.entryNumber || p.paymentNo, allocation,
      };
    });

    return NextResponse.json({ ok: true, paymentAccounts, expenseAccounts, suppliers, customers, bills: formattedBills, invoices: formattedInvoices, payments: formattedPayments });
  } catch (error) { return NextResponse.json({ ok: false, error: "Failed to load payment workspace data" }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const company = await getCompany();
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const { mode, accountId, expenseAccountId, supplierId, billId, customerId, invoiceId, method, amount, paymentDate, reference, description, action } = body;
    const numAmount = Number(amount);
    if (!accountId) return NextResponse.json({ ok: false, error: "Payment/Deposit account is required" }, { status: 400 });
    if (!numAmount || numAmount <= 0) return NextResponse.json({ ok: false, error: "Valid amount is required" }, { status: 400 });

    const settings = await prisma.companySettings.findUnique({ where: { companyId: company.id } });
    const accounting = (settings?.accounting as AccountingSettings) ?? {};
    const arAccountId = accounting.arAccountId || accounting.accountsReceivableAccountId;
    const apAccountId = accounting.apAccountId || accounting.accountsPayableAccountId;
    
    const shouldPost = action === "POST";
    const dateObj = paymentDate ? new Date(paymentDate) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.payment.count({ where: { companyId: company.id } });
      const payPrefix = mode === "receive" ? "REC" : mode === "supplier" ? "PAY" : "EXP";
      const paymentNo = `${payPrefix}-${String(count + 1).padStart(6, "0")}`;

      const payment = await tx.payment.create({
        data: {
          companyId: company.id, paymentNo, paymentDate: dateObj, type: mode === "receive" ? "RECEIPT" : "PAYMENT",
          method: method || "CASH", amount: numAmount, accountId, expenseAccountId: mode === "expense" ? expenseAccountId : null,
          reference: reference || null, description: description || null, supplierId: mode === "supplier" ? supplierId : null,
          customerId: mode === "receive" ? customerId : null,
        },
      });

      if (mode === "receive" && invoiceId) {
        const invoice = await tx.salesInvoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new Error("Invoice not found");
        await tx.salesPaymentAllocation.create({ data: { paymentId: payment.id, invoiceId: invoice.id, amount: numAmount } });

        if (shouldPost) {
          const newPaid = Number(invoice.paid) + numAmount;
          const newBal = Math.max(0, Number(invoice.total) - newPaid);
          await tx.salesInvoice.update({ where: { id: invoice.id }, data: { paid: newPaid, balance: newBal, status: newBal === 0 ? "PAID" : "PARTIAL" } });
          if (!arAccountId) throw new Error("Accounts Receivable account is not configured in Settings.");

          const entryNumber = await nextVoucherNumber(tx, company.id, `CRV-${dateObj.getFullYear()}-`);
          const je = await tx.journalEntry.create({
            data: {
              companyId: company.id, entryNumber, entryDate: payment.paymentDate, reference: payment.paymentNo,
              description: description || `CRV - Receipt from customer for invoice ${invoice.invoiceNo}`, status: "DRAFT", referenceType: "SALE",
              lines: { create: [ { accountId, description: `Deposit — ${payment.paymentNo}`, debit: numAmount, credit: 0 }, { accountId: arAccountId, description: `AR Settlement`, debit: 0, credit: numAmount } ] },
            },
          });
          await tx.payment.update({ where: { id: payment.id }, data: { journalId: je.id } });
        }
      }

      if (mode === "supplier" && billId) {
        const bill = await tx.purchaseBill.findUnique({ where: { id: billId } });
        if (!bill) throw new Error("Purchase bill not found");
        await tx.purchasePaymentAllocation.create({ data: { paymentId: payment.id, billId: bill.id, amount: numAmount } });

        if (shouldPost) {
          const newPaid = Number(bill.paid) + numAmount;
          const newBal = Math.max(0, Number(bill.total) - newPaid);
          await tx.purchaseBill.update({ where: { id: bill.id }, data: { paid: newPaid, balance: newBal, status: newBal === 0 ? "PAID" : "PARTIAL" } });
          if (!apAccountId) throw new Error("Accounts Payable account is not configured in Settings.");

          const entryNumber = await nextVoucherNumber(tx, company.id, `CPV-${dateObj.getFullYear()}-`);
          const je = await tx.journalEntry.create({
            data: {
              companyId: company.id, entryNumber, entryDate: payment.paymentDate, reference: payment.paymentNo,
              description: description || `CPV - Payment to supplier for bill ${bill.billNo}`, status: "DRAFT", referenceType: "PURCHASE",
              lines: { create: [ { accountId: apAccountId, description: `AP Settlement`, debit: numAmount, credit: 0 }, { accountId, description: `Disbursement — ${payment.paymentNo}`, debit: 0, credit: numAmount } ] },
            },
          });
          await tx.payment.update({ where: { id: payment.id }, data: { journalId: je.id } });
        }
      }

      if (mode === "expense" && shouldPost) {
        if (!expenseAccountId) throw new Error("Expense Head account is required.");
        const expAcc = await tx.account.findUnique({ where: { id: expenseAccountId } });
        const entryNumber = await nextVoucherNumber(tx, company.id, `CPV-${dateObj.getFullYear()}-`);
        const je = await tx.journalEntry.create({
          data: {
            companyId: company.id, entryNumber, entryDate: payment.paymentDate, reference: payment.paymentNo,
            description: description || `CPV Expense: ${expAcc?.name || "Operating Expense"}`, status: "DRAFT",
            lines: { create: [ { accountId: expenseAccountId, description: description || `Expense`, debit: numAmount, credit: 0 }, { accountId, description: `Paid From Account — ${payment.paymentNo}`, debit: 0, credit: numAmount } ] },
          },
        });
        await tx.payment.update({ where: { id: payment.id }, data: { journalId: je.id } });
      }

      return payment;
    });

    const alertMsg = `VOUCHER CREATED: ${result.paymentNo}\n\nPlease note down this number for your records.\nIt has been saved as a DRAFT and sent to the Payments Inbox for Manager Approval.`;
    return NextResponse.json({ ok: true, message: alertMsg, payment: result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to record payment" }, { status: 500 });
  }
}