import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

// Initialize the PostgreSQL pool and attach it to Prisma's adapter
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Export a single, reusable Prisma instance
const prisma = new PrismaClient({ adapter });

export default prisma;