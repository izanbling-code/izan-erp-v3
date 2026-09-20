const fs = require('fs');
const path = './prisma/schema.prisma';
let schema = fs.readFileSync(path, 'utf8');

if (!schema.includes('orders        Order[]')) {
  schema = schema.replace(
    /model Customer\s*\{([\s\S]*?)(@@index)/,
    (match, body, idx) => 'model Customer {' + body + '  orders        Order[]\n  whatsapp      String?\n\n  ' + idx
  );
}

if (!schema.includes('enum OrderStatus')) {
  schema += "\n// --- E-COMMERCE & WHATSAPP MODELS ---\n\nenum OrderStatus {\n  SALE_ORDER\n  CONFIRMATION\n  PACKING\n  BOOKED\n  DISPATCHED\n}\n\nenum PaymentStatus {\n  PENDING\n  PARTIAL\n  PAID\n  REFUNDED\n}\n\nmodel Order {\n  id            String        @id @default(cuid())\n  companyId     String\n  orderNumber   String\n  customerId    String\n  customer      Customer      @relation(fields: [customerId], references: [id])\n  status        OrderStatus   @default(SALE_ORDER)\n  paymentStatus PaymentStatus @default(PENDING)\n  totalAmount   Float\n  whatsappRef   String?\n  createdAt     DateTime      @default(now())\n  updatedAt     DateTime      @updatedAt\n\n  @@index([companyId])\n  @@unique([companyId, orderNumber])\n}\n";
}

fs.writeFileSync(path, schema, 'utf8');
console.log('Schema successfully patched without errors!');
