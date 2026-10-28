import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:relife@localhost:5432/izeon_books?schema=public",
});

async function runMigration() {
  await client.connect();
  console.log("Connected to PostgreSQL for Attendance & Employment migration...");

  // 1. Add userId column and shift timings to Employee table if not exists
  try {
    await client.query(`
      ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "userId" INTEGER UNIQUE REFERENCES "User"("id") ON DELETE SET NULL;
      ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "shiftInTime" VARCHAR(20) DEFAULT '09:30';
      ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "shiftOutTime" VARCHAR(20) DEFAULT '18:30';
      ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "gracePeriodMinutes" INTEGER DEFAULT 15;
    `);
    console.log("✓ Employee shift timing & userId columns verified/created");
  } catch (err) {
    console.warn("Notice on Employee columns:", err.message);
  }

  // 2. Create AttendancePolicy table
  await client.query(`
    CREATE TABLE IF NOT EXISTS "AttendancePolicy" (
      "id" SERIAL PRIMARY KEY,
      "expectedInTime" VARCHAR(20) NOT NULL DEFAULT '09:30',
      "expectedOutTime" VARCHAR(20) NOT NULL DEFAULT '18:30',
      "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 15,
      "lateDeductionPerDay" DOUBLE PRECISION NOT NULL DEFAULT 100,
      "deductionType" VARCHAR(50) NOT NULL DEFAULT 'FLAT',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✓ AttendancePolicy table verified/created");

  // Insert default AttendancePolicy row if table is empty
  const policyCheck = await client.query(`SELECT COUNT(*) FROM "AttendancePolicy"`);
  if (parseInt(policyCheck.rows[0].count) === 0) {
    await client.query(`
      INSERT INTO "AttendancePolicy" ("expectedInTime", "expectedOutTime", "gracePeriodMinutes", "lateDeductionPerDay", "deductionType")
      VALUES ('09:30', '18:30', 15, 100, 'FLAT');
    `);
    console.log("✓ Seeded default AttendancePolicy");
  }

  // 3. Create EmployeeAttendance table
  await client.query(`
    CREATE TABLE IF NOT EXISTS "EmployeeAttendance" (
      "id" SERIAL PRIMARY KEY,
      "employeeId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
      "date" VARCHAR(20) NOT NULL,
      "inTime" VARCHAR(20),
      "outTime" VARCHAR(20),
      "workHours" DOUBLE PRECISION DEFAULT 0,
      "isLate" BOOLEAN DEFAULT FALSE,
      "lateMinutes" INTEGER DEFAULT 0,
      "lateDeduction" DOUBLE PRECISION DEFAULT 0,
      "status" VARCHAR(50) DEFAULT 'PRESENT',
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_employee_date UNIQUE ("employeeId", "date")
    );
  `);
  console.log("✓ EmployeeAttendance table verified/created");

  // 4. Update SalaryPayment table for lateDays & lateDeduction
  try {
    await client.query(`
      ALTER TABLE "SalaryPayment" ADD COLUMN IF NOT EXISTS "lateDays" INTEGER DEFAULT 0;
      ALTER TABLE "SalaryPayment" ADD COLUMN IF NOT EXISTS "lateDeduction" DOUBLE PRECISION DEFAULT 0;
    `);
    console.log("✓ SalaryPayment updated with lateDays and lateDeduction");
  } catch (err) {
    console.warn("Notice on SalaryPayment alteration:", err.message);
  }

  // 5. Create indexes
  const indexQueries = [
    `CREATE INDEX IF NOT EXISTS idx_employee_userid ON "Employee"("userId");`,
    `CREATE INDEX IF NOT EXISTS idx_empattendance_empid ON "EmployeeAttendance"("employeeId");`,
    `CREATE INDEX IF NOT EXISTS idx_empattendance_date ON "EmployeeAttendance"("date");`,
    `CREATE INDEX IF NOT EXISTS idx_empattendance_status ON "EmployeeAttendance"("status");`
  ];

  for (const q of indexQueries) {
    try {
      await client.query(q);
      console.log("✓ Applied index:", q);
    } catch (err) {
      console.warn("Notice for index:", q, err.message);
    }
  }

  // 6. Automatically sync existing HR users into Employee table if they are not already there
  const hrUsersRes = await client.query(`SELECT id, username, email FROM "User" WHERE role = 'HR'`);
  for (const hr of hrUsersRes.rows) {
    const existingEmp = await client.query(
      `SELECT id FROM "Employee" WHERE "userId" = $1 OR "email" = $2`,
      [hr.id, hr.email]
    );
    if (existingEmp.rows.length === 0) {
      // Generate empCode
      const empCountRes = await client.query(`SELECT COUNT(*) FROM "Employee"`);
      const nextNum = parseInt(empCountRes.rows[0].count) + 1;
      const empCode = `EMP-${String(nextNum).padStart(3, "0")}`;
      await client.query(`
        INSERT INTO "Employee" ("empCode", "name", "email", "role", "department", "userId", "baseSalary", "status")
        VALUES ($1, $2, $3, 'HR', 'Human Resources', $4, 0, 'ACTIVE')
      `, [empCode, hr.username, hr.email, hr.id]);
      console.log(`✓ Synced existing HR user "${hr.username}" (${hr.email}) to Employee directory as ${empCode}`);
    } else {
      // Ensure userId is linked
      await client.query(
        `UPDATE "Employee" SET "userId" = $1 WHERE "id" = $2 AND "userId" IS NULL`,
        [hr.id, existingEmp.rows[0].id]
      );
    }
  }

  await client.end();
  console.log("Attendance & Employment Migration Completed Successfully!");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
