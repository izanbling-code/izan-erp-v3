const fs = require('fs');
const path = require('path');

// Fix Session model in schema.prisma to auto-generate IDs
const schemaPath = path.join('prisma', 'schema.prisma');
if (fs.existsSync(schemaPath)) {
    let schema = fs.readFileSync(schemaPath, 'utf8');
    schema = schema.replace(/model\s+Session\s*\{([^}]*)\}/g, (match, inner) => {
        if (inner.includes('id') && !inner.includes('@default')) {
            inner = inner.replace(/id\s+String\s+@id[^\r\n]*/, 'id        String   @id @default(cuid())');
        }
        return `model Session {${inner}}`;
    });
    fs.writeFileSync(schemaPath, schema, 'utf8');
    console.log('✓ Fixed Session model in schema.prisma');
}

// Clean up the login route syntax error
const loginPath = path.join('app', 'api', 'auth', 'login', 'route.ts');
if (fs.existsSync(loginPath)) {
    let code = fs.readFileSync(loginPath, 'utf8');
    // Remove the broken injection artifact
    code = code.replace(/`n\s*id:\s*crypto\.randomUUID\(\),?/g, '');
    code = code.replace(/id:\s*crypto\.randomUUID\(\),?/g, '');
    fs.writeFileSync(loginPath, code, 'utf8');
    console.log('✓ Cleaned up app/api/auth/login/route.ts syntax');
}
