const fs = require("fs");
const path = require("path");

function fixPrismaInstances(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            fixPrismaInstances(fullPath);
        } else if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
            // Skip the actual config files so we don't break your master database connection!
            if (fullPath.replace(/\\/g, "/").includes("/lib/prisma.ts") || fullPath.replace(/\\/g, "/").includes("/lib/db.ts")) continue;

            let content = fs.readFileSync(fullPath, "utf8");
            if (content.includes("new PrismaClient()")) {
                // 1. Remove the old, unconfigured PrismaClient imports
                content = content.replace(/import\s+\{\s*PrismaClient\s*\}\s*from\s+['"][^'"]+['"];?\s*/g, '');
                
                // 2. Delete the raw local instantiation
                content = content.replace(/const\s+prisma\s*=\s*new\s+PrismaClient\(\);?/g, '');
                
                // 3. Inject the master configured Prisma instance at the very top of the file
                content = 'import { prisma } from "@/app/lib/prisma";\n' + content;
                
                fs.writeFileSync(fullPath, content);
                console.log("Wired up master Prisma instance in: " + fullPath);
            }
        }
    }
}

["app", "services"].forEach(d => {
    fixPrismaInstances(path.join(process.cwd(), d));
});
