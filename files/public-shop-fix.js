const fs = require("fs");
const path = require("path");

// 1. Strip the private ERP sidebar wrapper from the public shop page
const shopPage = path.join(process.cwd(), "app/shop/page.tsx");
if (fs.existsSync(shopPage)) {
    let content = fs.readFileSync(shopPage, "utf8");
    
    // Remove the ERP layout imports
    content = content.replace(/import\s+\{\s*(ERPShell|DashboardLayout|AdminLayout|Layout|AppLayout)\s*\}\s*from[^;\n]+;?/g, "");
    
    // Swap the private ERP wrapper tags for a clean, public background container
    content = content.replace(/<\s*(ERPShell|DashboardLayout|AdminLayout|Layout|AppLayout)[^>]*>/g, "<div className=\"min-h-screen bg-gray-50\">");
    content = content.replace(/<\/\s*(ERPShell|DashboardLayout|AdminLayout|Layout|AppLayout)\s*>/g, "</div>");
    
    fs.writeFileSync(shopPage, content);
    console.log("Stripped ERP sidebar wrapper from public shop page.");
}

// 2. Whitelist /shop and customer checkout APIs in the Auth Middleware
const mwPath = path.join(process.cwd(), "middleware.ts");
if (fs.existsSync(mwPath)) {
    let content = fs.readFileSync(mwPath, "utf8");
    
    // Inject a bypass for the shop immediately as the middleware function fires
    content = content.replace(/(export\s+(?:default\s+)?(?:async\s+)?function\s+middleware\s*\(\s*([a-zA-Z0-9_]+)[^)]*\)\s*\{)/, 
        `$1\n  if ($2.nextUrl.pathname === '/shop' || $2.nextUrl.pathname.startsWith('/api/shop/checkout')) return NextResponse.next();\n`);
        
    // Also patch Next.js config matchers if they exist
    if (content.includes("matcher")) {
        content = content.replace(/\(\?\!/g, "(?!shop|api/shop/checkout|");
    }
    
    // Ensure NextResponse is available for the bypass command
    if (!content.includes("NextResponse") && content.includes("next/server")) {
        content = content.replace(/from\s+['"]next\/server['"]/, "NextResponse } from 'next/server'");
        content = content.replace(/\{ NextResponse \}/, "{ NextResponse ");
    } else if (!content.includes("NextResponse")) {
        content = "import { NextResponse } from 'next/server';\n" + content;
    }

    fs.writeFileSync(mwPath, content);
    console.log("Whitelisted /shop and /api/shop/checkout in security middleware.");
}
