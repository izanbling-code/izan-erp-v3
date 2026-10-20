const fs = require("fs");
const path = require("path");

const mwPath = path.join(process.cwd(), "middleware.ts");
if (fs.existsSync(mwPath)) {
    let content = fs.readFileSync(mwPath, "utf8");
    
    // 1. Strip out the overly broad wildcards from the config matcher
    content = content.replace(/shop\|/g, "");
    content = content.replace(/api\/shop\/checkout\|/g, "");
    
    // 2. Remove the old bypass rule we injected earlier
    content = content.replace(/if\s*\([^)]*(?:\/shop\vert{}\/api\/shop\/checkout)[^)]*\)\s*return\s+NextResponse\.next\(\);?\n?/g, "");
    
    // 3. Inject strict, exact-path bypass logic that explicitly protects /shop/admin
    content = content.replace(/(export\s+(?:default\s+)?(?:async\s+)?function\s+middleware\s*\(\s*([a-zA-Z0-9_]+)[^)]*\)\s*\{)/, 
        `$1\n  const route = $2.nextUrl.pathname;\n  // EXPLICIT PUBLIC ROUTES\n  if (route === '/shop' || route === '/api/shop/checkout') return NextResponse.next();\n  // EVERYTHING ELSE (including /shop/admin) FALLS THROUGH TO ERP AUTHENTICATION\n`);

    fs.writeFileSync(mwPath, content);
    console.log("Locked down /shop/admin and secured the middleware matcher.");
}
