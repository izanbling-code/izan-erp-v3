const fs = require("fs");
const path = require("path");

function fixPrismaImports(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            fixPrismaImports(fullPath);
        } else if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
            let content = fs.readFileSync(fullPath, "utf8");
            let original = content;
            content = content.replace(/from\s+['"]@prisma\/client['"]/g, 'from "@/app/generated/prisma/client"');
            if (content !== original) {
                fs.writeFileSync(fullPath, content);
                console.log("Fixed Prisma import in: " + fullPath);
            }
        }
    }
}

["app", "lib", "services"].forEach(d => {
    fixPrismaImports(path.join(process.cwd(), d));
});
