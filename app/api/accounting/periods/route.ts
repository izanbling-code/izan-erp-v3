import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { supabase } from "@/app/lib/supabase";

async function getCompany() {
  return prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
}

// Calculate live Revenue, Expense, Net Profit, and Account-by-Account breakdown for each month
async function enrichPeriodsWithPnL(companyId: string, periods: any[]) {
  const { data: accounts } = await supabase
    .from("Account")
    .select("id, code, name, type")
    .eq("companyId", companyId);

  const accountMap = new Map<string, any>();
  (accounts || []).forEach((a: any) => accountMap.set(a.id, a));

  const { data: journals } = await supabase
    .from("JournalEntry")
    .select(
      "id, entryDate, status, referenceType, lines:JournalLine(accountId, debit, credit)"
    )
    .eq("companyId", companyId);

  const allJournals = journals || [];

  return periods.map((p: any) => {
    const start = new Date(p.startDate).getTime();
    const end = new Date(p.endDate).getTime();

    let revenue = 0;
    let expense = 0;
    let unpostedCount = 0;

    const breakdownMap = new Map<
      string,
      { code: string; name: string; type: string; amount: number }
    >();

    for (const j of allJournals) {
      const t = new Date(j.entryDate).getTime();
      if (t < start || t > end) continue;

      if (j.status !== "POSTED") {
        unpostedCount++;
        continue;
      }

      // Ignore the closing sweep entry itself when calculating the month's operating P&L
      if (j.referenceType === "PERIOD_CLOSE") continue;

      for (const line of j.lines || []) {
        const acc = accountMap.get(line.accountId);
        if (!acc) continue;
        const dr = Number(line.debit || 0);
        const cr = Number(line.credit || 0);

        if (acc.type === "REVENUE") {
          const val = cr - dr;
          revenue += val;
          const prev = breakdownMap.get(acc.id) || {
            code: acc.code,
            name: acc.name,
            type: "REVENUE",
            amount: 0,
          };
          prev.amount += val;
          breakdownMap.set(acc.id, prev);
        } else if (acc.type === "EXPENSE") {
          const val = dr - cr;
          expense += val;
          const prev = breakdownMap.get(acc.id) || {
            code: acc.code,
            name: acc.name,
            type: "EXPENSE",
            amount: 0,
          };
          prev.amount += val;
          breakdownMap.set(acc.id, prev);
        }
      }
    }

    const netProfit = revenue - expense;
    return {
      ...p,
      liveRevenue: Number(revenue.toFixed(2)),
      liveExpense: Number(expense.toFixed(2)),
      liveNetProfit: Number(netProfit.toFixed(2)),
      unpostedJournalsCount: unpostedCount,
      pnlBreakdown: Array.from(breakdownMap.values()).filter(
        (b) => Math.abs(b.amount) >= 0.01
      ),
    };
  });
}

export async function GET() {
  try {
    const company = await getCompany();
    if (!company) {
      return NextResponse.json(
        { ok: false, error: "No company configured" },
        { status: 400 }
      );
    }

    let periods = await prisma.fiscalPeriod.findMany({
      where: { companyId: company.id },
      orderBy: { startDate: "asc" },
    });

    if (periods.length === 0) {
      const year = new Date().getFullYear();
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      for (let i = 0; i < 12; i++) {
        const start = new Date(year, i, 1, 0, 0, 0, 0);
        const end = new Date(year, i + 1, 0, 23, 59, 59, 999);
        await prisma.fiscalPeriod.create({
          data: {
            companyId: company.id,
            name: `${months[i]} ${year}`,
            startDate: start,
            endDate: end,
            status: "OPEN",
          },
        });
      }

      periods = await prisma.fiscalPeriod.findMany({
        where: { companyId: company.id },
        orderBy: { startDate: "asc" },
      });
    }

    const enriched = await enrichPeriodsWithPnL(company.id, periods);
    return NextResponse.json({ ok: true, periods: enriched });
  } catch (error) {
    console.error("GET /api/accounting/periods error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load periods",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const company = await getCompany();
    if (!company) {
      return NextResponse.json(
        { ok: false, error: "No company configured" },
        { status: 400 }
      );
    }

    const { periodId, status } = await request.json();
    if (!periodId || !status) {
      return NextResponse.json(
        { ok: false, error: "Period ID and status are required" },
        { status: 400 }
      );
    }

    const { data: period } = await supabase
      .from("FiscalPeriod")
      .select("*")
      .eq("id", periodId)
      .maybeSingle();

    if (!period) {
      return NextResponse.json(
        { ok: false, error: "Fiscal period not found" },
        { status: 404 }
      );
    }

    const startISO = new Date(period.startDate).toISOString();
    const endISO = new Date(period.endDate).toISOString();

    // ==========================================
    // CASE 1: REOPENING TO "OPEN" (Reverses any Closing Sweep Journal)
    // ==========================================
    if (status === "OPEN") {
      if (period.closingJournalId) {
        await supabase
          .from("JournalEntry")
          .delete()
          .eq("id", period.closingJournalId);
      }
      await supabase
        .from("JournalEntry")
        .delete()
        .eq("referenceType", "PERIOD_CLOSE")
        .eq("referenceId", periodId);

      const { data: reopened, error: rErr } = await supabase
        .from("FiscalPeriod")
        .update({
          status: "OPEN",
          closedAt: null,
          closedBy: null,
          closingJournalId: null,
          closingJournalNo: null,
        })
        .eq("id", periodId)
        .select()
        .single();

      if (rErr) throw rErr;

      return NextResponse.json({
        ok: true,
        period: reopened,
        message: `${period.name} unlocked and reopened. Any closing Retained Earnings sweep has been reversed.`,
      });
    }

    // ==========================================
    // CASE 2: SOFT-LOCKING TO "LOCKED"
    // ==========================================
    if (status === "LOCKED") {
      const { data: locked, error: lErr } = await supabase
        .from("FiscalPeriod")
        .update({
          status: "LOCKED",
        })
        .eq("id", periodId)
        .select()
        .single();

      if (lErr) throw lErr;

      return NextResponse.json({
        ok: true,
        period: locked,
        message: `${period.name} is now LOCKED for audit review. Click "Close Month" when ready to sweep Profit/Loss to Retained Earnings.`,
      });
    }

    // ==========================================
    // CASE 3: HARD CLOSING ("CLOSED") -> VALIDATE + SWEEP P&L TO RETAINED EARNINGS
    // ==========================================
    const validationErrors: string[] = [];

    // 1. Unposted Journal Entries
    const unpostedJournals = await prisma.journalEntry.count({
      where: {
        companyId: company.id,
        entryDate: {
          gte: new Date(period.startDate),
          lte: new Date(period.endDate),
        },
        status: { not: "POSTED" },
      },
    });
    if (unpostedJournals > 0) {
      validationErrors.push(
        `Found ${unpostedJournals} unposted Journal Entry/Entries in ${period.name}.`
      );
    }

    // 2. Draft Sales Invoices (FIXED: uses invoiceDate instead of issueDate)
    const draftInvoices = await prisma.salesInvoice.count({
      where: {
        companyId: company.id,
        invoiceDate: {
          gte: new Date(period.startDate),
          lte: new Date(period.endDate),
        },
        status: "DRAFT",
      },
    });
    if (draftInvoices > 0) {
      validationErrors.push(
        `Found ${draftInvoices} draft Sales Invoice(s) in ${period.name}. Post or delete drafts first.`
      );
    }

    // 3. Draft Purchase Bills
    const draftBills = await prisma.purchaseBill.count({
      where: {
        companyId: company.id,
        billDate: {
          gte: new Date(period.startDate),
          lte: new Date(period.endDate),
        },
        status: "DRAFT",
      },
    });
    if (draftBills > 0) {
      validationErrors.push(
        `Found ${draftBills} draft Purchase Bill(s) in ${period.name}. Post or delete drafts first.`
      );
    }

    // 4. Unapproved Payment Vouchers
    const { count: unapprovedVouchers } = await supabase
      .from("PaymentVoucher")
      .select("*", { count: "exact", head: true })
      .gte("paymentDate", startISO)
      .lte("paymentDate", endISO)
      .neq("status", "POSTED");

    if ((unapprovedVouchers || 0) > 0) {
      validationErrors.push(
        `Found ${unapprovedVouchers} unapproved Payment Voucher(s) in ${period.name}. Approve or reject them in the Admin Approval Box first.`
      );
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot close ${period.name} due to pending unposted/unapproved records:`,
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    // Fetch all Accounts to identify REVENUE, EXPENSE, and 3200 Retained Earnings
    const { data: accounts } = await supabase
      .from("Account")
      .select("id, code, name, type")
      .eq("companyId", company.id);

    const accountMap = new Map<string, any>();
    (accounts || []).forEach((a: any) => accountMap.set(a.id, a));

    let retainedEarningsAcc = (accounts || []).find(
      (a: any) =>
        a.type === "EQUITY" &&
        (String(a.name).toLowerCase().includes("retained") || a.code === "3200")
    );
    if (!retainedEarningsAcc) {
      retainedEarningsAcc = (accounts || []).find((a: any) => a.type === "EQUITY");
    }
    if (!retainedEarningsAcc) {
      const { data: createdEquity } = await supabase
        .from("Account")
        .insert([
          {
            companyId: company.id,
            code: "3200",
            name: "Retained Earnings",
            type: "EQUITY",
            isActive: true,
          },
        ])
        .select()
        .single();
      retainedEarningsAcc = createdEquity;
    }

    // Fetch all POSTED journals in this month
    const { data: periodJournals } = await supabase
      .from("JournalEntry")
      .select(
        "id, entryDate, status, referenceType, lines:JournalLine(accountId, debit, credit)"
      )
      .eq("companyId", company.id)
      .eq("status", "POSTED")
      .gte("entryDate", startISO)
      .lte("entryDate", endISO);

    const netByAccount = new Map<string, number>();
    let totalRevenue = 0;
    let totalExpense = 0;

    for (const j of periodJournals || []) {
      if (j.referenceType === "PERIOD_CLOSE") continue;
      for (const line of j.lines || []) {
        const acc = accountMap.get(line.accountId);
        if (!acc || (acc.type !== "REVENUE" && acc.type !== "EXPENSE")) continue;

        const dr = Number(line.debit || 0);
        const cr = Number(line.credit || 0);

        if (acc.type === "REVENUE") totalRevenue += cr - dr;
        if (acc.type === "EXPENSE") totalExpense += dr - cr;

        const prev = netByAccount.get(acc.id) || 0;
        netByAccount.set(acc.id, prev + (cr - dr));
      }
    }

    const netProfit = Number((totalRevenue - totalExpense).toFixed(2));
    const closingLines: Array<{
      accountId: string;
      debit: number;
      credit: number;
      description: string;
    }> = [];

    for (const [accId, netCreditMinusDebit] of netByAccount.entries()) {
      const rounded = Number(netCreditMinusDebit.toFixed(2));
      if (Math.abs(rounded) < 0.01) continue;
      const acc = accountMap.get(accId);

      if (rounded > 0) {
        closingLines.push({
          accountId: accId,
          debit: rounded,
          credit: 0,
          description: `Monthly Closing Sweep to 0 — ${acc?.code} ${acc?.name} (${period.name})`,
        });
      } else {
        closingLines.push({
          accountId: accId,
          debit: 0,
          credit: Math.abs(rounded),
          description: `Monthly Closing Sweep to 0 — ${acc?.code} ${acc?.name} (${period.name})`,
        });
      }
    }

    if (
      closingLines.length > 0 &&
      Math.abs(netProfit) >= 0.01 &&
      retainedEarningsAcc
    ) {
      if (netProfit > 0) {
        closingLines.push({
          accountId: retainedEarningsAcc.id,
          debit: 0,
          credit: netProfit,
          description: `Net Profit rolled into Retained Earnings (${period.name})`,
        });
      } else {
        closingLines.push({
          accountId: retainedEarningsAcc.id,
          debit: Math.abs(netProfit),
          credit: 0,
          description: `Net Loss rolled into Retained Earnings (${period.name})`,
        });
      }
    }

    let closingJournalId: string | null = null;
    let closingJournalNo: string | null = null;

    if (closingLines.length > 0) {
      const monthTag = new Date(period.startDate).toISOString().slice(0, 7);
      closingJournalNo = `CLS-${monthTag}`;

      await supabase
        .from("JournalEntry")
        .delete()
        .eq("companyId", company.id)
        .eq("referenceType", "PERIOD_CLOSE")
        .eq("referenceId", periodId);

      const { data: createdJournal, error: cjErr } = await supabase
        .from("JournalEntry")
        .insert([
          {
            companyId: company.id,
            entryNo: closingJournalNo,
            entryNumber: closingJournalNo,
            entryDate: endISO,
            reference: closingJournalNo,
            referenceType: "PERIOD_CLOSE",
            referenceId: periodId,
            description: `Monthly Closing Sweep to Retained Earnings — ${period.name}`,
            status: "POSTED",
          },
        ])
        .select()
        .single();

      if (cjErr) throw cjErr;
      closingJournalId = createdJournal.id;

      await supabase.from("JournalLine").insert(
        closingLines.map((l) => ({
          journalEntryId: createdJournal.id,
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          description: l.description,
        }))
      );
    }

    const { data: updatedPeriod, error: uErr } = await supabase
      .from("FiscalPeriod")
      .update({
        status: "CLOSED",
        closedAt: new Date().toISOString(),
        closedBy: "Admin",
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalExpense: Number(totalExpense.toFixed(2)),
        netProfit,
        closingJournalId,
        closingJournalNo,
      })
      .eq("id", periodId)
      .select()
      .single();

    if (uErr) throw uErr;

    return NextResponse.json({
      ok: true,
      period: updatedPeriod,
      message: `${period.name} CLOSED! All Revenue & Expense accounts swept to 0.00 and Net ${
        netProfit >= 0 ? "Profit" : "Loss"
      } moved to 3200 - Retained Earnings (${closingJournalNo || "No P&L Activity"}).`,
    });
  } catch (error) {
    console.error("POST /api/accounting/periods error:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to update period",
      },
      { status: 500 }
    );
  }
}