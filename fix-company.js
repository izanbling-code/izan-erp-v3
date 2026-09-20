const fs = require('fs');
const path = require('path');

const schemaPath = path.join('prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Ensure Company model exists
if (!schema.includes('model Company')) {
    schema += `\n\nmodel Company {
  id        String   @id @default(cuid())
  name      String   @default("Izan Bling")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  fiscalPeriods FiscalPeriod[]
  accounts      Account[]
  salesInvoices SalesInvoice[]
  purchaseBills PurchaseBill[]
  journalEntries JournalEntry[]
  products      Product[]
  warehouses    Warehouse[]
}
`;
    fs.writeFileSync(schemaPath, schema.trim() + '\n', 'utf8');
    console.log('✓ Added Company model to schema.prisma.');
} else {
    console.log('✓ Company model already exists.');
}
