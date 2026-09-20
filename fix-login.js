const fs = require('fs');
const path = require('path');

// Fix Session model in schema.prisma
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
    console.log('✓ schema.prisma Session model updated.');
}

// Fix login route by explicitly injecting id: crypto.randomUUID()
const loginPath = path.join('app', 'api', 'auth', 'login', 'route.ts');
if (fs.existsSync(loginPath)) {
    let code = fs.readFileSync(loginPath, 'utf8');
    
    // Clean up any old broken artifacts
    code = code.replace(/id\s*:\s*crypto\.randomUUID\(\),?/g, '');
    code = code.replace(/`n/g, '');

    // Inject id right inside prisma.session.create data block
    if (code.includes('prisma.session.create')) {
        code = code.replace(
            /prisma\.session\.create\s*\(\s*\{\s*data\s*:\s*\{/,
            'prisma.session.create({\n      data: {\n        id: crypto.randomUUID(),'
        );
        fs.writeFileSync(loginPath, code, 'utf8');
        console.log('✓ Successfully injected explicit session ID into login route.');
    }
}
