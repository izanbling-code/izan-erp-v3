import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface TransactionLine {
  accountId: string;
  debit: number;
  credit: number;
}

interface PostingPayload {
  companyId: string;
  description: string;
  reference?: string;
  lines: TransactionLine[];
}

export async function postFinancialTransaction(payload: PostingPayload) {
  const { companyId, description, reference, lines } = payload;

  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(`ACID REJECTION: Journal is out of balance. Debits: ${totalDebit}, Credits: ${totalCredit}`);
  }

  return await prisma.$transaction(async (tx) => {
    
    // Uses companyId to match your V2 multi-tenant architecture
    const counter = await tx.sequenceCounter.upsert({
      where: { 
        tenantId_model: { tenantId: companyId, model: "JournalEntry" } 
      },
      update: { nextVal: { increment: 1 } },
      create: { tenantId: companyId, model: "JournalEntry", prefix: "JE-", nextVal: 2 }
    });
    
    const generatedNumber = `${counter.prefix}${counter.nextVal - 1}`;

    const entry = await tx.journalEntry.create({
      data: {
        companyId,
        jeNumber: generatedNumber,
        description,
        reference,
        lines: {
          create: lines.map((line) => ({
            companyId,
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit
          }))
        }
      },
      include: { lines: true }
    });

    return entry;
  });
}