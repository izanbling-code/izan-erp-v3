const fs = require("fs");
const path = require("path");

const shopPage = path.join(process.cwd(), "app/shop/page.tsx");
if (fs.existsSync(shopPage)) {
    let content = fs.readFileSync(shopPage, "utf8");
    
    // Find the name of the main shop function
    const match = content.match(/export\s+default\s+function\s+([A-Za-z0-9_]+)/);
    if (match) {
        const funcName = match[1];
        
        // Remove the 'export default' from the original function
        content = content.replace(new RegExp(`export\\s+default\\s+function\\s+${funcName}`), `function ${funcName}`);
        
        // Create a new default export that wraps the shop in a full-screen overlay to hide the ERP sidebar
        content += `\n\n// Viewport Breakout Wrapper to hide ERP Layout\nexport default function PublicShopWrapper() {\n  return (\n    <div className="fixed inset-0 z-[99999] bg-[#0B1120] overflow-y-auto w-screen h-screen m-0 p-0 block">\n      <${funcName} />\n    </div>\n  );\n}\n`;
        
        fs.writeFileSync(shopPage, content);
        console.log("Successfully applied the Viewport Breakout wrapper to the public shop!");
    } else {
        console.log("Could not find the default export in app/shop/page.tsx");
    }
}
