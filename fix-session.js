const fs = require('fs');
const path = require('path');
const schemaPath = path.join('prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Fix Session model id to auto-generate cuid()
schema = schema.replace(/model Session\s*\{([^}]+)\}/g, (match, inner) => {
    if (inner.includes('id') && !inner.includes('@default')) {
        const updatedInner = inner.replace(/id\s+String\s+@id/, 'id        String   @id @default(cuid())');
        console.log('✓ Updated Session model id with default cuid.');
        return `model Session {${updatedInner}}`;
    }
    return match;
});

fs.writeFileSync(schemaPath, schema, 'utf8');
