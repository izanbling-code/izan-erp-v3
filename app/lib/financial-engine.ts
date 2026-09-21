import { prisma } from "@/app/lib/prisma";
import { AccountType } from "@prisma/client";

export async function getHierarchicalBalances(companyId: string) {
  // 1. Fetch all active accounts and their POSTED journal lines
  const accounts = await prisma.account.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      parentId: true,
      name: true,
      type: true,
      lines: {
        where: { journalEntry: { status: "POSTED" } },
        select: { debit: true, credit: true }
      }
    }
  });

  // 2. Calculate isolated (direct) balances for every account
  const accountMap = new Map();
  
  accounts.forEach((acc) => {
    const totalDebit = acc.lines.reduce((sum, line) => sum + Number(line.debit), 0);
    const totalCredit = acc.lines.reduce((sum, line) => sum + Number(line.credit), 0);
    
    let directBalance = 0;
    // Assets & Expenses increase with Debits
    if (acc.type === "ASSET" || acc.type === "EXPENSE") {
      directBalance = totalDebit - totalCredit;
    } 
    // Liabilities, Equity & Revenue increase with Credits
    else {
      directBalance = totalCredit - totalDebit;
    }

    accountMap.set(acc.id, {
      ...acc,
      directBalance,
      rolledUpBalance: directBalance, // Will be updated in step 3
      children: []
    });
  });

  // 3. Build the tree structure
  const rootAccounts: any[] = [];
  accountMap.forEach((acc) => {
    if (acc.parentId && accountMap.has(acc.parentId)) {
      accountMap.get(acc.parentId).children.push(acc);
    } else {
      rootAccounts.push(acc);
    }
  });

  // 4. Recursive function to roll up balances from the bottom up
  function calculateRollup(node: any): number {
    let childSum = 0;
    for (const child of node.children) {
      childSum += calculateRollup(child);
    }
    node.rolledUpBalance = node.directBalance + childSum;
    return node.rolledUpBalance;
  }

  // 5. Execute roll-up for all root nodes
  rootAccounts.forEach((root) => calculateRollup(root));

  return { rootAccounts, flatMap: accountMap };
}