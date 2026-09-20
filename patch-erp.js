const fs = require('fs');
const path = require('path');

console.log('Starting ERP patch script...');

// 1. Fix schema.prisma
const schemaPath = path.join('prisma', 'schema.prisma');
if (fs.existsSync(schemaPath)) {
    let schema = fs.readFileSync(schemaPath, 'utf8');
    schema = schema.replace(/generator\s+client\s+\{[\s\S]*?\}/, `generator client {\n  provider = "prisma-client-js"\n}`);
    
    if (schema.includes('model Session')) {
        schema = schema.replace(/model\s+Session\s*\{([^}]*)\}/, (m, inner) => {
            let u = inner;
            if (!u.includes('@default(cuid())')) {
                u = u.replace(/id\s+String\s+@id[^\r\n]*/, 'id        String   @id @default(cuid())');
            }
            if (!u.includes('updatedAt')) {
                u += '\n  updatedAt DateTime @default(now())';
            } else if (u.includes('updatedAt') && !u.includes('@default')) {
                u = u.replace(/updatedAt\s+DateTime[^\r\n]*/, 'updatedAt DateTime @default(now())');
            }
            return `model Session {${u}}`;
        });
    }
    fs.writeFileSync(schemaPath, schema, 'utf8');
    console.log('✓ schema.prisma updated successfully.');
}

// 2. Fix app/lib/prisma.ts
const prismaTsPath = path.join('app', 'lib', 'prisma.ts');
if (fs.existsSync(prismaTsPath)) {
    let pCode = fs.readFileSync(prismaTsPath, 'utf8');
    pCode = pCode.replace(/from\s+["\'].*generated\/prisma["\']/g, 'from "@prisma/client"');
    fs.writeFileSync(prismaTsPath, pCode, 'utf8');
    console.log('✓ app/lib/prisma.ts updated successfully.');
}

// 3. Fix login route
const loginPath = path.join('app', 'api', 'auth', 'login', 'route.ts');
if (fs.existsSync(loginPath)) {
    let code = fs.readFileSync(loginPath, 'utf8');
    if (code.includes('prisma.session.create')) {
        code = code.replace(/id\s*:\s*crypto\.randomUUID\(\),?\s*/g, '');
        code = code.replace(/updatedAt\s*:\s*new Date\(\),?\s*/g, '');
        
        code = code.replace(
            /(prisma\.session\.create\s*\(\s*\{\s*data\s*:\s*\{)/,
            '$1\n        id: crypto.randomUUID(),\n        updatedAt: new Date(),'
        );
        fs.writeFileSync(loginPath, code, 'utf8');
        console.log('✓ app/api/auth/login/route.ts patched successfully.');
    }
}

console.log('All patches applied successfully!');
