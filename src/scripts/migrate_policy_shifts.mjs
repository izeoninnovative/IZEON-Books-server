import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pg;

const client = new Client({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:relife@localhost:5432/izeon_books?schema=public",
});

async function runMigration() {
  await client.connect();
  console.log("Connected to PostgreSQL for Shift-wise Late Deduction migration...");

  try {
    // 1. Add lateDeduction900 and lateDeduction930 to AttendancePolicy table
    await client.query(`
      ALTER TABLE "AttendancePolicy" ADD COLUMN IF NOT EXISTS "lateDeduction900" DOUBLE PRECISION DEFAULT 100;
      ALTER TABLE "AttendancePolicy" ADD COLUMN IF NOT EXISTS "lateDeduction930" DOUBLE PRECISION DEFAULT 100;
    `);

    // Backfill from lateDeductionPerDay if null
    await client.query(`
      UPDATE "AttendancePolicy"
      SET "lateDeduction930" = COALESCE("lateDeduction930", "lateDeductionPerDay", 100),
          "lateDeduction900" = COALESCE("lateDeduction900", "lateDeductionPerDay", 100);
    `);

    console.log("✓ AttendancePolicy updated with lateDeduction900 and lateDeduction930");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

runMigration();
