import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:relife@localhost:5432/izeon_books?schema=public",
});

async function main() {
  await client.connect();
  console.log("Connected to PostgreSQL for Appraisal migration...");

  // 1. Add appraisal tracking columns to Employee
  await client.query(`
    ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastAppraisalDate" VARCHAR(30);
    ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastAppraisalSalary" DOUBLE PRECISION;
    ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastAppraisalIncrement" DOUBLE PRECISION;
    ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastAppraisalNotes" TEXT;
  `);
  console.log("✓ Added last appraisal columns to Employee");

  // 2. Create EmployeeAppraisal table for full history tracking
  await client.query(`
    CREATE TABLE IF NOT EXISTS "EmployeeAppraisal" (
      "id" SERIAL PRIMARY KEY,
      "employeeId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
      "previousSalary" DOUBLE PRECISION NOT NULL,
      "newSalary" DOUBLE PRECISION NOT NULL,
      "incrementAmount" DOUBLE PRECISION NOT NULL,
      "incrementPercentage" DOUBLE PRECISION,
      "appraisalDate" VARCHAR(30) NOT NULL,
      "nextAppraisalDate" VARCHAR(30),
      "rating" VARCHAR(50),
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "idx_employee_appraisal_emp" ON "EmployeeAppraisal"("employeeId");
    CREATE INDEX IF NOT EXISTS "idx_employee_appraisal_date" ON "EmployeeAppraisal"("appraisalDate");
  `);
  console.log("✓ Created EmployeeAppraisal history table & indexes");

  await client.end();
  console.log("Migration complete!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
