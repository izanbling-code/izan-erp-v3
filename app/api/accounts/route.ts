import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

const ACCOUNT_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
] as const;

type AccountType = (typeof ACCOUNT_TYPES)[number];

function isAccountType(value: unknown): value is AccountType {
  return (
    typeof value === "string" &&
    ACCOUNT_TYPES.includes(value as AccountType)
  );
}

async function getCompany() {
  return prisma.company.findFirst({
    orderBy: {
      createdAt: "asc",
    },
  });
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();

  return cleaned.length > 0 ? cleaned : null;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error.";
}

export async function GET() {
  try {
    const company = await getCompany();
    if (!company) {
      return NextResponse.json({ ok: false, error: "No company configured." }, { status: 400 });
    }

    const accounts = await prisma.account.findMany({
      where: { companyId: company.id },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    });

    // 1. TRUE LEDGER SYNC: Calculate exact live balances from POSTED Journal Lines
    const glLines = await prisma.journalLine.groupBy({
      by: ['accountId'],
      _sum: { debit: true, credit: true },
      where: { journalEntry: { status: 'POSTED', companyId: company.id } }
    });

    const baseBalances = new Map<string, number>();
    for (const line of glLines) {
      const acc = accounts.find((a: any) => a.id === line.accountId);
      if (!acc) continue;
      
      const debit = Number(line._sum.debit || 0);
      const credit = Number(line._sum.credit || 0);
      
      if (acc.type === "ASSET" || acc.type === "EXPENSE") {
        baseBalances.set(acc.id, debit - credit);
      } else {
        baseBalances.set(acc.id, credit - debit);
      }
    }

    // 2. MAP RAW BALANCES
    const enrichedAccounts = accounts.map((acc: any) => ({
      ...acc,
      baseBalance: baseBalances.get(acc.id) || 0,
      balance: 0 
    }));

    // 3. RECURSIVE ROLL-UP ENGINE: Pass sub-account wealth up to the Parent
    function getRolledUpBalance(accId: string): number {
      const acc = enrichedAccounts.find((a: any) => a.id === accId);
      if (!acc) return 0;
      
      let total = acc.baseBalance;
      const children = enrichedAccounts.filter((a: any) => a.parentId === accId);
      for (const child of children) {
        total += getRolledUpBalance(child.id);
      }
      return total;
    }

    // 4. APPLY ROLL-UP TO ALL ACCOUNTS
    for (const acc of enrichedAccounts) {
      const total = getRolledUpBalance(acc.id);
      acc.balance = total;
      (acc as any).currentBalance = total; // Universal failsafe for UI binding
    }

    return NextResponse.json({ ok: true, accounts: enrichedAccounts });
  } catch (error) {
    console.error("GET /api/accounts error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load accounts." }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const company = await getCompany();

    if (!company) {
      return NextResponse.json(
        {
          ok: false,
          error: "No company has been configured yet.",
        },
        { status: 400 }
      );
    }

    const code = cleanString(body.code);
    const name = cleanString(body.name);
    const description = cleanString(body.description);
    const parentId = cleanString(body.parentId);
    const type = body.type;

    if (!code) {
      return NextResponse.json(
        {
          ok: false,
          error: "Account code is required.",
        },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          error: "Account name is required.",
        },
        { status: 400 }
      );
    }

    if (!isAccountType(type)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid account type.",
        },
        { status: 400 }
      );
    }

    if (parentId) {
      const parent = await prisma.account.findFirst({
        where: {
          id: parentId,
          companyId: company.id,
        },
      });

      if (!parent) {
        return NextResponse.json(
          {
            ok: false,
            error: "Selected parent account does not exist.",
          },
          { status: 400 }
        );
      }
    }

    const existing = await prisma.account.findFirst({
      where: {
        companyId: company.id,
        code,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error: `Account code ${code} already exists.`,
        },
        { status: 409 }
      );
    }

    const account = await prisma.account.create({
      data: {
        companyId: company.id,
        code,
        name,
        type,
        description,
        parentId,
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        account,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/accounts error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const company = await getCompany();

    if (!company) {
      return NextResponse.json(
        {
          ok: false,
          error: "No company has been configured yet.",
        },
        { status: 400 }
      );
    }

    const id = cleanString(body.id);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Account id is required.",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.account.findFirst({
      where: {
        id,
        companyId: company.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          error: "Account not found.",
        },
        { status: 404 }
      );
    }
    if (existing.systemCode) {
      if (
        (body.code !== undefined &&
          String(body.code) !== String(existing.code)) ||
        (body.type !== undefined &&
          String(body.type) !== String(existing.type))
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "System account code and type cannot be changed.",
          },
          { status: 400 }
        );
      }
    }
const code =
      body.code !== undefined
        ? cleanString(body.code)
        : existing.code;

    const name =
      body.name !== undefined
        ? cleanString(body.name)
        : existing.name;

    const description =
      body.description !== undefined
        ? cleanString(body.description)
        : existing.description;

    const parentId =
      body.parentId !== undefined
        ? cleanString(body.parentId)
        : existing.parentId;

    const type =
      body.type !== undefined
        ? body.type
        : existing.type;

    const isActive =
      body.isActive !== undefined
        ? Boolean(body.isActive)
        : existing.isActive;

    if (!code) {
      return NextResponse.json(
        {
          ok: false,
          error: "Account code is required.",
        },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          error: "Account name is required.",
        },
        { status: 400 }
      );
    }

    if (!isAccountType(type)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid account type.",
        },
        { status: 400 }
      );
    }

    if (parentId === id) {
      return NextResponse.json(
        {
          ok: false,
          error: "An account cannot be its own parent.",
        },
        { status: 400 }
      );
    }

    if (parentId) {
      const parent = await prisma.account.findFirst({
        where: {
          id: parentId,
          companyId: company.id,
        },
      });

      if (!parent) {
        return NextResponse.json(
          {
            ok: false,
            error: "Selected parent account does not exist.",
          },
          { status: 400 }
        );
      }
    }

    const duplicate = await prisma.account.findFirst({
      where: {
        companyId: company.id,
        code,
        NOT: {
          id,
        },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        {
          ok: false,
          error: `Account code ${code} already exists.`,
        },
        { status: 409 }
      );
    }

    const account = await prisma.account.update({
      where: {
        id,
      },
      data: {
        code,
        name,
        type,
        description,
        parentId,
        isActive,
      },
    });

    return NextResponse.json({
      ok: true,
      account,
    });
  } catch (error) {
    console.error("PUT /api/accounts error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    const company = await getCompany();

    if (!company) {
      return NextResponse.json(
        {
          ok: false,
          error: "No company has been configured yet.",
        },
        { status: 400 }
      );
    }

    const id = cleanString(body.id);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Account id is required.",
        },
        { status: 400 }
      );
    }

    const account = await prisma.account.findFirst({
      where: {
        id,
        companyId: company.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          ok: false,
          error: "Account not found.",
        },
        { status: 404 }
      );
    }

    if (account.systemCode) {
      return NextResponse.json(
        {
          ok: false,
          error: "System accounts cannot be deleted.",
        },
        { status: 400 }
      );
    }

    const childCount = await prisma.account.count({
      where: {
        companyId: company.id,
        parentId: account.id,
      },
    });

    if (childCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This account has child accounts. Move or delete the child accounts first.",
        },
        { status: 400 }
      );
    }

    const journalLineCount = await prisma.journalLine.count({
      where: {
        accountId: account.id,
      },
    });

    const productReferenceCount =
      (await prisma.product.count({
        where: {
          OR: [
            {
              inventoryAccountId: account.id,
            },
            {
              salesAccountId: account.id,
            },
            {
              cogsAccountId: account.id,
            },
            {
              purchaseAccountId: account.id,
            },
          ],
        },
      }));

    const paymentReferenceCount = await prisma.payment.count({
      where: {
        accountId: account.id,
      },
    });

    if (
      journalLineCount > 0 ||
      productReferenceCount > 0 ||
      paymentReferenceCount > 0
    ) {
      await prisma.account.update({
        where: {
          id: account.id,
        },
        data: {
          isActive: false,
        },
      });

      return NextResponse.json({
        ok: true,
        deleted: false,
        deactivated: true,
        message:
          "This account has historical or module references, so it was deactivated instead of deleted.",
      });
    }

    await prisma.account.delete({
      where: {
        id: account.id,
      },
    });

    return NextResponse.json({
      ok: true,
      deleted: true,
      deactivated: false,
      message: "Account deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE /api/accounts error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage(error),
      },
      { status: 500 }
    );
  }
}



