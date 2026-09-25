const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function patchDb() {
  try {
    const roles = await prisma.role.findMany();
    let count = 0;
    for (const r of roles) {
      if (r.name.toLowerCase().includes("admin")) {
        await prisma.role.update({
          where: { id: r.id },
          data: { permissions: ["/"] }
        });
        count++;
      }
    }
    console.log(`\n✅ Successfully upgraded ${count} Admin role(s) to universal access ["/"]\n`);
  } catch (e) {
    console.error("Patch failed:", e);
  } finally {
    await prisma.$disconnect();
  }
}
patchDb();
