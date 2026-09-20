import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const company = await prisma.company.findFirst();
    if (!company) throw new Error("Company not found");

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const accounts = await prisma.account.findMany({
      where: { companyId: company.id, type: "ASSET" },
      orderBy: { code: 'asc' }
    });

    const targetAccountId = accountId && accountId !== "default" 
      ? accountId 
      : accounts.find(a => a.name.toLowerCase().includes("cash"))?.id || accounts[0]?.id;

    if (!targetAccountId) return NextResponse.json({ ok: true, data: [], openingBalance: 0, accounts });
    const targetAccount = accounts.find(a => a.id === targetAccountId);

    // FETCH COMPLETE JOURNAL ENTRIES: We include all lines to read the structural double-entry logic
    const allLines = await prisma.journalLine.findMany({
      where: { accountId: targetAccountId, journalEntry: { companyId: company.id, status: "POSTED" } },
      include: { 
        journalEntry: {
          include: { lines: { include: { account: true } } }
        } 
      },
      orderBy: [ { journalEntry: { entryDate: 'asc' } }, { journalEntry: { createdAt: 'asc' } } ]
    });

    let openingBalance = 0;
    let runningBalance = 0;
    const periodTransactions: any[] = [];
    
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (end) end.setUTCHours(23, 59, 59, 999);

    for (const line of allLines) {
      const txDate = new Date(line.journalEntry.entryDate);
      const amount = Number(line.debit) - Number(line.credit); 
      
      if (start && txDate < start) {
        openingBalance += amount;
        runningBalance += amount;
      } else if ((!start || txDate >= start) && (!end || txDate <= end)) {
        runningBalance += amount;
        
        // PURE ACCOUNTING LOGIC ENGINE
        let type = "General";
        const entry = line.journalEntry;
        
        // Find the opposing accounts (where the money is actually coming from/going to)
        const otherLines = entry.lines.filter(l => l.accountId !== targetAccountId);

        if (entry.referenceType === "OPENING" || entry.reference?.startsWith("OB-")) {
          type = "Opening Balance";
        } else if (otherLines.length > 0) {
          // Identify the primary offsetting account (the one handling the bulk of the money)
          const mainOffset = otherLines.reduce((prev, curr) => 
            (Number(prev.debit) + Number(prev.credit)) > (Number(curr.debit) + Number(curr.credit)) ? prev : curr
          );
          
          const accType = String(mainOffset.account.type).toUpperCase();
          const accName = String(mainOffset.account.name).toLowerCase();

          // Classify purely based on Master Chart of Accounts structure
          if (accType === "REVENUE" || accType === "INCOME") {
            type = "Cash Sale";
          } else if (accType === "EXPENSE") {
            type = "Expense";
          } else if (accType === "LIABILITY") {
            type = accName.includes("payable") || accName.includes("supplier") ? "Supplier Payment" : "Liability Payment";
          } else if (accType === "EQUITY") {
            type = "Capital / Equity";
          } else if (accType === "ASSET") {
            if (accName.includes("receivable") || accName.includes("customer")) type = "Customer Receipt";
            else if (accName.includes("bank") || accName.includes("deposit") || accName.includes("easypaisa") || accName.includes("jazzcash")) type = "Bank Transfer";
            else type = "Asset Transfer";
          }
        }

        periodTransactions.push({
          id: line.id,
          date: txDate,
          type: type,
          voucherId: entry.reference || entry.entryNo,
          description: entry.description,
          amount: amount,
          balance: runningBalance
        });
      }
    }

    return NextResponse.json({ ok: true, data: periodTransactions, openingBalance, accounts, selectedAccount: targetAccount });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}