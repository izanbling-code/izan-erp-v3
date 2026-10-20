import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type OpeningRow = { accountId: string; debit: string; credit: string; };

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function amountString(value: unknown): string {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  if (typeof value !== "string") return "0";
  return value.trim() || "0";
}

function isValidAmount(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value) && Number(value) >= 0;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error.";
}

async function getCompany() {
  return prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
}

async function nextEntryNumber(companyId: string): Promise<string> {
  const latest = await prisma.journalEntry.findFirst({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: { entryNumber: true },
  });
  const match = latest?.entryNumber?.match(/(\d+)$/);
  if (!match) return "JE-000001";
  const next = Number(match[1]) + 1;
  return `JE-${String(next).padStart(6, "0")}`;
}

export async function GET() {
  try {
    const company = await getCompany();
    if (!company) return NextResponse.json({ ok: false, error: "No company configured." }, { status: 400 });

    const accounts = await prisma.account.findMany({
      where: { companyId: company.id, isActive: true },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    });

    const openingEntries = await prisma.journalEntry.findMany({
      where: { companyId: company.id, referenceType: "OPENING" },
      orderBy: { entryDate: "asc" },
      include: { lines: { include: { account: true } } },
    });

    const openingBalances = openingEntries.flatMap((entry) =>
      entry.lines.map((line) => ({
        id: line.id, accountId: line.accountId, journalEntryId: entry.id,
        balanceDate: entry.entryDate, debit: line.debit, credit: line.credit, account: line.account,
      }))
    );

    return NextResponse.json({ ok: true, accounts, openingBalances });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to load opening balances." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const company = await getCompany();
    if (!company) return NextResponse.json({ ok: false, error: "No company configured." }, { status: 400 });

    const balanceDateValue = cleanString(body.balanceDate);
    const rawRows: unknown[] = Array.isArray(body.rows) ? body.rows : [];

    if (!balanceDateValue) return NextResponse.json({ ok: false, error: "Opening balance date required." }, { status: 400 });
    const balanceDate = new Date(balanceDateValue);
    if (Number.isNaN(balanceDate.getTime())) return NextResponse.json({ ok: false, error: "Invalid date." }, { status: 400 });
    if (rawRows.length === 0) return NextResponse.json({ ok: false, error: "At least one row required." }, { status: 400 });

    const rows: OpeningRow[] = rawRows.map((raw) => {
      const row = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
      return { accountId: cleanString(row.accountId) ?? "", debit: amountString(row.debit), credit: amountString(row.credit) };
    });

    const accountIds = rows.map((row) => row.accountId).filter((id): id is string => id.length > 0);
    if (accountIds.length !== rows.length) return NextResponse.json({ ok: false, error: "Every row must have an account." }, { status: 400 });
    
    const uniqueAccountIds = [...new Set(accountIds)];
    if (uniqueAccountIds.length !== accountIds.length) return NextResponse.json({ ok: false, error: "Each account can only appear once per batch." }, { status: 400 });

    const accounts = await prisma.account.findMany({ where: { companyId: company.id, id: { in: uniqueAccountIds }, isActive: true } });
    if (accounts.length !== uniqueAccountIds.length) return NextResponse.json({ ok: false, error: "Invalid accounts selected." }, { status: 400 });

    let totalDebit = 0; let totalCredit = 0;
    for (const row of rows) {
      if (!isValidAmount(row.debit) || !isValidAmount(row.credit)) return NextResponse.json({ ok: false, error: "Invalid amounts." }, { status: 400 });
      if (Number(row.debit) > 0 && Number(row.credit) > 0) return NextResponse.json({ ok: false, error: "Cannot have both debit and credit." }, { status: 400 });
      if (Number(row.debit) === 0 && Number(row.credit) === 0) return NextResponse.json({ ok: false, error: "Row must contain an amount." }, { status: 400 });
      totalDebit += Number(row.debit); totalCredit += Number(row.credit);
    }

    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      return NextResponse.json({ ok: false, error: `Not balanced. Dr: ${totalDebit.toFixed(2)}, Cr: ${totalCredit.toFixed(2)}` }, { status: 400 });
    }

    // THE RESTRICTION BLOCK HAS BEEN PERMANENTLY REMOVED HERE. 
    // You can now post infinite opening balance updates to the same account.

    const entryNumber = await nextEntryNumber(company.id);
    const accountMap = new Map(accounts.map((account) => [account.id, account]));

    const result = await prisma.$transaction(async (tx) => {
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId: company.id,
          entryNumber,
          entryDate: balanceDate,
          reference: `OB-${entryNumber}`, // Unique dynamic reference
          description: "Opening balances update",
          status: "POSTED",
          referenceType: "OPENING",
          lines: {
            create: rows.map((row) => ({
              accountId: row.accountId,
              debit: row.debit,
              credit: row.credit,
              description: `Opening balance - ${accountMap.get(row.accountId)?.name ?? "Account"}`
            }))
          }
        },
        include: { lines: { include: { account: true } } }
      });

      return {
        journalEntry,
        openingBalances: journalEntry.lines.map((line) => ({
          id: line.id, accountId: line.accountId, journalEntryId: journalEntry.id,
          balanceDate: journalEntry.entryDate, debit: line.debit, credit: line.credit, account: line.account
        }))
      };
    });

    return NextResponse.json({ ok: true, message: "Opening balances posted successfully.", ...result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}