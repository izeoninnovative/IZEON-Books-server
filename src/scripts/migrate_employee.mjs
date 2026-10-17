import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:relife@localhost:5432/izeon_books?schema=public",
});

async function runMigration() {
  await client.connect();
  console.log("Connected to PostgreSQL for Employee & Payroll migration...");

  // 1. Create EmployeeStatus enum if not exists
  try {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmployeeStatus') THEN
          CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');
        END IF;
      END$$;
    `);
    console.log("✓ EmployeeStatus enum verified/created");
  } catch (err) {
    console.warn("Notice on EmployeeStatus enum:", err.message);
  }

  // 2. Create Employee table
  await client.query(`
    CREATE TABLE IF NOT EXISTS "Employee" (
      "id" SERIAL PRIMARY KEY,
      "empCode" VARCHAR(50) UNIQUE NOT NULL,
      "name" VARCHAR(255) NOT NULL,
      "email" VARCHAR(255),
      "phone" VARCHAR(50),
      "role" VARCHAR(255) NOT NULL,
      "department" VARCHAR(100),
      "joiningDate" VARCHAR(50),
      "baseSalary" DOUBLE PRECISION DEFAULT 0,
      "appraisalDate" VARCHAR(50),
      "status" "EmployeeStatus" DEFAULT 'ACTIVE',
      "bankName" VARCHAR(255),
      "accountNumber" VARCHAR(100),
      "ifscCode" VARCHAR(50),
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✓ Employee table verified/created");

  // 3. Create EmployeeLop table
  await client.query(`
    CREATE TABLE IF NOT EXISTS "EmployeeLop" (
      "id" SERIAL PRIMARY KEY,
      "employeeId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
      "month" INTEGER NOT NULL,
      "year" INTEGER NOT NULL,
      "lopDays" DOUBLE PRECISION DEFAULT 0,
      "lopAmount" DOUBLE PRECISION DEFAULT 0,
      "reason" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✓ EmployeeLop table verified/created");

  // 4. Update SalaryPayment columns
  const alterColumns = [
    `ALTER TABLE "SalaryPayment" ADD COLUMN IF NOT EXISTS "employeeId" INTEGER REFERENCES "Employee"("id") ON DELETE SET NULL;`,
    `ALTER TABLE "SalaryPayment" ADD COLUMN IF NOT EXISTS "baseSalary" DOUBLE PRECISION;`,
    `ALTER TABLE "SalaryPayment" ADD COLUMN IF NOT EXISTS "lopDays" DOUBLE PRECISION DEFAULT 0;`,
    `ALTER TABLE "SalaryPayment" ADD COLUMN IF NOT EXISTS "lopDeduction" DOUBLE PRECISION DEFAULT 0;`
  ];

  for (const query of alterColumns) {
    try {
      await client.query(query);
      console.log("✓ Applied SalaryPayment alteration:", query);
    } catch (err) {
      console.warn("Notice altering SalaryPayment:", err.message);
    }
  }

  // 5. Create indexes
  const indexQueries = [
    `CREATE INDEX IF NOT EXISTS idx_employee_empcode ON "Employee"("empCode");`,
    `CREATE INDEX IF NOT EXISTS idx_employee_status ON "Employee"("status");`,
    `CREATE INDEX IF NOT EXISTS idx_employeelop_employeeId ON "EmployeeLop"("employeeId");`,
    `CREATE INDEX IF NOT EXISTS idx_employeelop_year_month ON "EmployeeLop"("year", "month");`,
    `CREATE INDEX IF NOT EXISTS idx_salarypayment_employeeId ON "SalaryPayment"("employeeId");`
  ];

  for (const q of indexQueries) {
    try {
      await client.query(q);
      console.log("✓ Applied index:", q);
    } catch (err) {
      console.warn("Notice for index:", q, err.message);
    }
  }

  await client.end();
  console.log("Employee & Payroll Database Migration Completed Successfully!");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
