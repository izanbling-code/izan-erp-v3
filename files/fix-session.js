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

<<<<<<< HEAD
fs.writeFileSync(schemaPath, schema, 'utf8');
=======
fs.writeFileSync(schemaPath, schema, 'utf8');
>>>>>>> 3ceb2f10778766d22e4f70de8c0696a63a885434
