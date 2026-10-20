const fs = require("fs");
const path = require("path");

function fixJSX(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            fixJSX(fullPath);
        } else if (fullPath.endsWith(".tsx")) {
            let content = fs.readFileSync(fullPath, "utf8");
            let original = content;
            
            // 1. Aggressively match the layout tags and wipe out corrupted props
            content = content.replace(/<\s*(DashboardLayout|AdminLayout|Layout|AppLayout)[^>]*>/g, "<$1>");
            
            // 2. Fallback to manually clean up any detached fragments
            content = content.replace(/Panel`\}>/g, "");
            content = content.replace(/`\}>/g, ">");
            
            if (content !== original) {
                fs.writeFileSync(fullPath, content);
                console.log("Repaired JSX in: " + fullPath);
            }
        }
    }
}

["app/accounting", "app/reports", "app/admin", "app/purchases"].forEach(d => {
    fixJSX(path.join(process.cwd(), d));
});
