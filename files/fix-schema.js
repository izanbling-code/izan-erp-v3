const fs = require('fs');
const path = require('path');

// 1. Write prisma.config.ts for Prisma v7
const configContent = `import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
`;
fs.writeFileSync('prisma.config.ts', configContent, 'utf8');
console.log('✓ prisma.config.ts updated.');

// 2. Fix schema.prisma
const schemaPath = path.join('prisma', 'schema.prisma');
if (!fs.existsSync(schemaPath)) {
    console.error('❌ schema.prisma not found!');
    process.exit(1);
}

let schema = fs.readFileSync(schemaPath, 'utf8');

// Strip BOM if present
if (schema.charCodeAt(0) === 0xFEFF) {
    schema = schema.slice(1);
}

// Remove url = ... from datasource block
schema = schema.replace(/datasource\s+db\s*\{([^}]*)\}/g, (match, inner) => {
    const cleanedInner = inner.replace(/url\s*=\s*[^\r\n]*/g, '');
    return `datasource db {${cleanedInner}}`;
});

// Append FiscalPeriod if not present
if (!schema.includes('model FiscalPeriod')) {
    schema += `\n\nmodel FiscalPeriod {
  id        String       @id @default(cuid())
  companyId String
  name      String
  startDate DateTime
  endDate   DateTime
  status    PeriodStatus @default(OPEN)
  closedAt  DateTime?
  closedBy  String?
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([companyId, name])
  @@index([companyId])
}

enum PeriodStatus {
  OPEN
  LOCKED
  CLOSED
}
`;
}

fs.writeFileSync(schemaPath, schema.trim() + '\n', 'utf8');
<<<<<<< HEAD
console.log('✓ prisma/schema.prisma successfully cleaned and updated.');
=======
console.log('✓ prisma/schema.prisma successfully cleaned and updated.');
>>>>>>> 3ceb2f10778766d22e4f70de8c0696a63a885434
