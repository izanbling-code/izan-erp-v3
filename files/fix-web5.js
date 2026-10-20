const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function fixInvoices() {
  console.log("Scanning invoices for unlinked couriers...");
  const invoices = await prisma.salesInvoice.findMany({
    where: { courierId: null, notes: { contains: "Courier:" } }
  });
  
  let count = 0;
  for (const inv of invoices) {
    const match = inv.notes.match(/Courier:\s*([^|]+)/i);
    if (match && match[1]) {
      const cName = match[1].trim();
      const courier = await prisma.courier.findFirst({
        where: { companyId: inv.companyId, name: { equals: cName, mode: "insensitive" } }
      });
      if (courier) {
        await prisma.salesInvoice.update({
          where: { id: inv.id },
          data: { courierId: courier.id }
        });
        count++;
      }
    }
  }
  console.log(`Success! Linked ${count} invoices to their Couriers.`);
}
fixInvoices().catch(console.error).finally(() => prisma.$disconnect());
