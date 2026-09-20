import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const defaultPermissions = [
      { name: "View Bank Accounts", module: "Banking", action: "view_banks", description: "View Bank Accounts" },
      { name: "Create & Edit Banks", module: "Banking", action: "manage_banks", description: "Create & Edit Banks" },
      { name: "Process Transfers", module: "Banking", action: "transfer_funds", description: "Process Transfers" },
      { name: "Bank Reconciliation", module: "Banking", action: "reconcile", description: "Bank Reconciliation" },
      { name: "View General Ledger", module: "Accounting", action: "view_ledgers", description: "View General Ledger" },
      { name: "Post Journal Entries", module: "Accounting", action: "post_journals", description: "Post Journal Entries" },
      { name: "Process Withdrawals", module: "Admin", action: "process_withdrawals", description: "Process Owner Withdrawals" },
      { name: "View Stock Levels", module: "Inventory", action: "view_stock", description: "View Stock Levels" },
      { name: "Adjust Inventory", module: "Inventory", action: "manage_stock", description: "Adjust Inventory" },
      { name: "Manage Roles", module: "Settings", action: "manage_roles", description: "Manage Roles & Permissions" },
      { name: "Manage Users", module: "Settings", action: "manage_users", description: "Manage System Users" }
    ];

    let count = 0;
    for (const perm of defaultPermissions) {
      const exists = await prisma.permission.findFirst({
        where: { module: perm.module, action: perm.action }
      });
      if (!exists) {
        await prisma.permission.create({ data: perm });
        count++;
      }
    }

    return NextResponse.json({ ok: true, message: `Successfully seeded ${count} new permissions into the database!` });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to seed permissions" }, { status: 500 });
  }
}
